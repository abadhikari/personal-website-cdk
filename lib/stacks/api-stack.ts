import { StackProps, Stack, Aws } from 'aws-cdk-lib';
import {
  AuthorizationType,
  BasePathMapping,
  CognitoUserPoolsAuthorizer,
  Cors,
  DomainName,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
} from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

import { ApiCachePolicy } from '../constructs/api-cache-policy';
import { ApiCloudFrontDistribution } from '../constructs/api-cloudfront-distribution';
import { ApiGatewayRestApi } from '../constructs/api-gateway-rest-api';
import { CognitoPool } from '../constructs/cognito-pool';
import { LambdaNodeFunction } from '../constructs/lambda-node-function';

export interface ApiStackProps extends StackProps {
  adminPool: CognitoPool;
  media: {
    deleteLambda: LambdaNodeFunction;
    generateSignedUrlsLambda: LambdaNodeFunction;
  };
  stack: {
    editLambda: LambdaNodeFunction;
    writeLambda: LambdaNodeFunction;
    readLambda: LambdaNodeFunction;
  };
  stacks: {
    readLambda: LambdaNodeFunction;
  };
  content: {
    writeLambda: LambdaNodeFunction;
  };
  contents: {
    readLambda: LambdaNodeFunction;
  };
  review: {
    writeLambda: LambdaNodeFunction;
  };
  reviews: {
    readLambda: LambdaNodeFunction;
  };
  lookups: {
    readLambda: LambdaNodeFunction;
    writeLambda: LambdaNodeFunction;
  };
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * ApiStack sets up the backend infrastructure for all things
 * api-related on abhinnaadhikari.com.
 *
 * Resources include:
 * - Api gateway rest api.
 */
export class ApiStack extends Stack {
  public readonly restApi: ApiGatewayRestApi;
  private readonly authorizer: CognitoUserPoolsAuthorizer;
  private readonly certificate: ICertificate;
  private readonly customDomain: DomainName;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // API Gateway
    this.restApi = new ApiGatewayRestApi(this, 'SiteApi', {
      restApiName: 'AbhinnaAdhikariApi',
      description: 'Central API for abhinnaadhikari.com website endpoints',
      cors: {
        allowMethods: Cors.ALL_METHODS,
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      stageName: 'prod',
      throttling: {
        rateLimit: 5,
        burstLimit: 20,
      },
    });

    // Setup custom domain for api
    this.certificate = Certificate.fromCertificateArn(
      this,
      'ApiCert',
      'arn:aws:acm:us-east-1:509399600387:certificate/d3fa4275-808f-433d-a78c-be107c519407',
    );

    this.customDomain = new DomainName(this, 'CustomDomain', {
      domainName: 'api.abhinnaadhikari.com',
      certificate: this.certificate,
    });

    new BasePathMapping(this, 'BasePathMapping', {
      domainName: this.customDomain,
      restApi: this.restApi.restApi,
      basePath: '',
    });

    // Configure authorizer for authentication
    this.authorizer = new CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [props.adminPool.userPool],
    });

    // media
    this.addLambdaRoute(props.media.deleteLambda, '/v1/media', 'DELETE');
    this.addLambdaRoute(
      props.media.generateSignedUrlsLambda,
      '/v1/media/upload-url',
      'POST',
    );

    // stacks
    this.addLambdaRoute(props.stack.editLambda, '/v1/stack', 'PATCH');
    this.addLambdaRoute(props.stack.readLambda, '/v1/stack', 'GET');
    this.addLambdaRoute(props.stack.writeLambda, '/v1/stack', 'POST');

    // stack
    this.addLambdaRoute(props.stacks.readLambda, '/v1/stacks', 'GET');

    // content
    this.addLambdaRoute(props.content.writeLambda, '/v1/content', 'POST');

    // contents
    this.addLambdaRoute(props.contents.readLambda, '/v1/contents', 'GET');

    // review
    this.addLambdaRoute(props.review.writeLambda, '/v1/review', 'POST');

    // reviews
    this.addLambdaRoute(props.reviews.readLambda, '/v1/reviews', 'GET');

    // lookups
    this.addLambdaRoute(props.lookups.readLambda, '/v1/lookups', 'GET');
    this.addLambdaRoute(props.lookups.writeLambda, '/v1/lookups', 'POST');

    // CloudFront
    const apiGatewayRegionalDomain = `${this.restApi.restApi.restApiId}.execute-api.${Stack.of(this).region}.${Aws.URL_SUFFIX}`;

    // Setup custom domain for cloudfront cache
    const cacheCertificate = Certificate.fromCertificateArn(
      this,
      'ApiCloudFrontCacheCert',
      'arn:aws:acm:us-east-1:509399600387:certificate/ee155ed3-9db8-4e21-b206-f2c97a40be47',
    );

    const cacheDistribution = new ApiCloudFrontDistribution(
      this,
      'ApiGatewayCache',
      {
        apiGatewayRegionalDomain,
        certificate: cacheCertificate,
        publicApiDomain: 'api-cache.abhinnaadhikari.com',
        stagePath: '/prod',
      },
    );

    // Setup Reviews path Cache
    const reviewsQueryParams = ['search', 'limit', 'cursor'];
    this.addCachedGetBehavior(
      cacheDistribution,
      '/v1/reviews*',
      reviewsQueryParams,
      600,
    );

    // Setup Stacks path Cache
    const stacksQueryParams = [
      'startTimestamp',
      'stackLimit',
      'endTimestamp',
      'lastEvaluatedKey',
    ];
    this.addCachedGetBehavior(
      cacheDistribution,
      '/v1/stacks*',
      stacksQueryParams,
      600,
    );
  }

  /**
   * Adds a Lambda integration to the API Gateway.
   *
   * Automatically applies Cognito authentication for all mutating methods
   * (POST, PATCH, PUT, DELETE), and leaves GET routes unauthenticated by default.
   *
   * @param lambda - The Lambda function to integrate with the API Gateway route.
   * @param path - The REST path for the route (e.g. '/v1/media').
   * @param method - The HTTP method for the route (e.g. 'GET', 'POST').
   */
  private addLambdaRoute(
    lambda: LambdaNodeFunction,
    path: string,
    method: HttpMethod,
  ) {
    const requiresAuthentication = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(
      method,
    );
    const options = requiresAuthentication
      ? {
          authorizer: this.authorizer,
          authorizationType: AuthorizationType.COGNITO,
        }
      : {};
    this.restApi.addLambdaIntegration(lambda.function, path, method, options);
  }

  /**
   * Adds a cached GET/HEAD behavior at CloudFront for a specific path.
   *
   * Creates a matching CachePolicy (TTL + query-string allow-list) and
   * OriginRequestPolicy (forwards the same query strings; no headers/cookies),
   * then wires them to the distribution.
   *
   * @param cacheDistribution - The CloudFront wrapper construct to attach the behavior to.
   * @param pathPattern - Viewer path pattern (e.g. '/v1/reviews*'). Must match the public URL.
   * @param queryStrings - Query params that change the response (used in both cache key and origin forward).
   * @param ttlSeconds - TTL for cached responses in seconds (default: 600).
   */
  private addCachedGetBehavior(
    cacheDistribution: ApiCloudFrontDistribution,
    pathPattern: string,
    queryStrings: string[],
    ttlSeconds = 600,
  ): void {
    const safePathId = pathPattern.replace(/[^\w]/g, '_');

    const cachePolicy = new ApiCachePolicy(
      this,
      `ApiCache10MinPolicy_${safePathId}`,
      {
        defaultTtlSeconds: ttlSeconds,
        maxTtlSeconds: ttlSeconds,
        queryParams: queryStrings,
      },
    );

    const originRequest = new OriginRequestPolicy(
      this,
      `OriginReq_${safePathId}`,
      {
        headerBehavior: OriginRequestHeaderBehavior.allowList('Origin'),
        cookieBehavior: OriginRequestCookieBehavior.none(),
        queryStringBehavior: queryStrings.length
          ? OriginRequestQueryStringBehavior.allowList(...queryStrings)
          : OriginRequestQueryStringBehavior.none(),
      },
    );

    cacheDistribution.addSimpleBehavior(
      pathPattern,
      cachePolicy.cachePolicy,
      originRequest,
      AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    );
  }
}
