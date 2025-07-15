import { StackProps, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  BasePathMapping,
  CognitoUserPoolsAuthorizer,
  Cors,
  DomainName,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

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
}
