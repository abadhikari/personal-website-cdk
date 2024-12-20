/**
 * Creates a standardized response for the API.
 *
 * @param statusCode - The HTTP status code.
 * @param body - The body to be returned in the response body.
 * @param origin - The Origin in the request header.
 * @returns An object representing the API Gateway error response.
 */
export function createResponse(
  statusCode: number,
  body: object,
  origin: string,
) {
  const headers = {
    ...(origin && {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    }),
  };

  return {
    statusCode: statusCode,
    headers: headers,
    body: JSON.stringify(body),
  };
}
