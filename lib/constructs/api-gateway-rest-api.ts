import { Construct } from 'constructs';
import {
  IResource,
  LambdaIntegration,
  RestApi,
  Resource,
} from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';

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
   * configuration that enables CORS (Cross-Origin Resource Sharing) for the API Gateway.
   */
  readonly cors?: {
    /**
     * A list of allowed origins for cross-origin requests.
     */
    allowOrigins: Array<string>;
    /**
     * A list of allowed HTTP methods for cross-origin requests.
     */
    allowMethods: Array<string>;
  };
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
    this.restApi = new RestApi(this, 'ApiGatewayRestApi', {
      restApiName: props.restApiName,
      description: props.description,
      defaultCorsPreflightOptions: props.cors && {
        allowOrigins: props.cors.allowOrigins,
        allowMethods: props.cors.allowMethods,
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
  ) {
    const resource = this.restApi.root.resourceForPath(resourcePath);
    const integration = new LambdaIntegration(lambdaFunction);
    resource.addMethod(method, integration);
  }
}
