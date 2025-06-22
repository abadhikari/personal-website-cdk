import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Creates a mock API Gateway event object for use in unit tests.
 *
 * This function helps simulate an incoming API Gateway request to a Lambda handler,
 * allowing customization of HTTP method, headers, query string parameters, path parameters, and body content.
 *
 * @param httpMethod - The HTTP method of the request (e.g., 'GET', 'POST', etc.).
 * @param headers - Optional HTTP headers to include in the event.
 * @param queryStringParameters - Optional query string parameters for the request.
 * @param pathParameters - Optional path parameters to simulate route variables.
 * @param body - The request body. If an object is provided, it will be JSON.stringified automatically.
 *               If a raw string is provided, it will be passed through as-is — useful for testing invalid JSON cases.
 *
 * @returns A partial APIGatewayProxyEvent object that can be passed into Lambda handlers during testing.
 */
export default function createMockEvent({
  httpMethod,
  headers,
  queryStringParameters,
  body,
  pathParameters,
  requestContext,
}: {
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: any;
  pathParameters?: Record<string, string>;
  requestContext?: any;
}): Partial<APIGatewayProxyEvent> {
  return {
    httpMethod,
    headers,
    queryStringParameters,
    pathParameters,
    body: body
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : undefined,
    requestContext,
  };
}
