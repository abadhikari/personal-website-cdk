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
import { CognitoPool } from '../constructs/cognito-pool';
import { ApiGatewayRestApi } from '../constructs/api-gateway-rest-api';
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
}

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

    this.authorizer = new CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [props.adminPool.userPool],
    });

    this.restApi.addLambdaIntegration(
      props.media.deleteLambda.function,
      '/v1/media',
      'DELETE',
      {
        authorizer: this.authorizer,
        authorizationType: AuthorizationType.COGNITO,
      },
    );

    this.restApi.addLambdaIntegration(
      props.stack.editLambda.function,
      '/v1/stack',
      'PATCH',
      {
        authorizer: this.authorizer,
        authorizationType: AuthorizationType.COGNITO,
      },
    );

    this.restApi.addLambdaIntegration(
      props.stack.readLambda.function,
      '/v1/stack',
      'GET',
    );

    this.restApi.addLambdaIntegration(
      props.stacks.readLambda.function,
      '/v1/stacks',
      'GET',
    );

    this.restApi.addLambdaIntegration(
      props.stack.writeLambda.function,
      '/v1/stack',
      'POST',
      {
        authorizer: this.authorizer,
        authorizationType: AuthorizationType.COGNITO,
      },
    );

    this.restApi.addLambdaIntegration(
      props.media.generateSignedUrlsLambda.function,
      'v1/media/upload-url',
      'POST',
      {
        authorizer: this.authorizer,
        authorizationType: AuthorizationType.COGNITO,
      },
    );
  }
}
