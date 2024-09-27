import { Construct } from 'constructs';
import {
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

  /**
   * A map that stores references to API Gateway resources.
   * Each key is a string representing the resource name or path,
   * and the value is the corresponding AWS API Gateway `Resource` object.
   */
  public readonly resourceMap: Record<string, Resource> = {};

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
   * Adds a Lambda integration to a versioned resource in API Gateway.
   *
   * This method ensures that the specified version ('v1') and resource ('media')
   * are created in API Gateway and integrated with the provided Lambda function. If the version or
   * resource already exists, it will be reused. The resource is associated with the specified HTTP
   * method (e.g., 'GET', 'POST') and integrated with the Lambda function.
   *
   * Example usage:
   * - For version 'v1' and resource 'media' with the 'GET' method, the resulting API path will be `/v1/media`.
   * - If `/v1/media` already exists, this method will add the specified method to the existing resource.
   *
   * @param lambdaFunction - The Lambda function to integrate with the API Gateway resource.
   * @param version - The API version (e.g., 'v1', 'v2'). This ensures the version is created in the API path.
   * @param resource - The name of the resource (e.g., 'media'). This represents the endpoint in the path.
   * @param method - The HTTP method for the API Gateway resource (e.g., 'GET', 'POST').
   */
  addLambdaIntegration(
    lambdaFunction: Function,
    version: string,
    resource: string,
    method: string
  ) {
    let versionResource = this.resourceMap[version];
    if (!versionResource) {
      versionResource = this.restApi.root.addResource(version);
      this.resourceMap[version] = versionResource;
    }

    const versionedResource = `${version}/${resource}`;
    let apiResource = this.resourceMap[versionedResource];
    if (!apiResource) {
      apiResource = versionResource.addResource(resource);
      this.resourceMap[versionedResource] = apiResource;
    }

    const integration = new LambdaIntegration(lambdaFunction);
    apiResource.addMethod(method, integration);
  }
}
