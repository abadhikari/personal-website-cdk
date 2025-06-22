import {
  LambdaIntegration,
  MethodOptions,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayRestApiProps {
  /**
   * The name of the Rest API.
   */
  readonly restApiName: string;

  /**
   * The description of the Rest API.
   */
  readonly description: string;

  /**
   * Configuration for throttling requests to the API Gateway.
   */
  readonly throttling: Throttling;

  /**
   * Optional custom stage name for the API Gateway deployment.
   */
  readonly stageName: string;

  /**
   * configuration that enables CORS (Cross-Origin Resource Sharing) for the API Gateway.
   */
  readonly cors?: Cors;
}

/**
 * Configuration for throttling requests to the API Gateway.
 */
interface Throttling {
  /**
   * The rate limit (requests per second) for the API Gateway stage.
   */
  rateLimit: number;

  /**
   * The burst limit (maximum number of requests allowed in a short period).
   */
  burstLimit: number;
}

/**
 * Configuration for enabling CORS (Cross-Origin Resource Sharing).
 */
interface Cors {
  /**
   * A list of allowed origins for cross-origin requests.
   */
  allowOrigins: Array<string>;

  /**
   * A list of allowed HTTP methods for cross-origin requests.
   */
  allowMethods: Array<string>;

  /**
   * A list of allowed HTTP headers for cross-origin requests.
   */
  allowHeaders: Array<string>;
}

/**
 * ApiGatewayRestApi is a construct that creates an APIGateway RestApi.
 */
export class ApiGatewayRestApi extends Construct {
  /**
   * The Rest API created by this construct.
   */
  public readonly restApi: RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayRestApiProps) {
    super(scope, id);
    const { restApiName, description, throttling, cors, stageName } = props;
    this.restApi = new RestApi(this, 'ApiGatewayRestApi', {
      restApiName,
      description,
      defaultCorsPreflightOptions: cors && {
        allowOrigins: cors.allowOrigins,
        allowMethods: cors.allowMethods,
        allowHeaders: cors.allowHeaders,
      },
      deployOptions: {
        stageName: stageName,
        throttlingRateLimit: throttling.rateLimit,
        throttlingBurstLimit: throttling.burstLimit,
      },
    });
  }

  /**
   * Adds a Lambda integration to a resource path in API Gateway.
   *
   * @param lambdaFunction - The Lambda function to integrate with the API Gateway resource.
   * @param resourcePath - The path of the resource (e.g., '/v1/media').
   * @param method - The HTTP method for the API Gateway resource (e.g., 'GET', 'POST').
   */
  addLambdaIntegration(
    lambdaFunction: Function,
    resourcePath: string,
    method: string,
    opts?: MethodOptions,
  ) {
    const resource = this.restApi.root.resourceForPath(resourcePath);
    const integration = new LambdaIntegration(lambdaFunction);
    resource.addMethod(method, integration, opts);
  }
}
