import { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Extracts the authenticated user's unique identifier (sub) from the request context.
 *
 * This function assumes that the API Gateway has a configured authorizer (e.g. Cognito, JWT authorizer)
 * that injects identity claims into the `event.requestContext.authorizer.claims` object.
 *
 * The `sub` claim is expected to represent the user's stable unique identifier.
 * If the claims object or `sub` is missing, an error is thrown to prevent unauthorized access.
 *
 * @param {APIGatewayProxyEvent} event - The Lambda request event containing authorizer context
 * @returns {string} The authenticated user's unique ID (sub claim)
 *
 * @throws {Error} If the user ID is not found in the request context (e.g. unauthenticated or misconfigured authorizer)
 */
export function retrieveUserIdFromEvent(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims || !claims.sub) {
    throw new Error('User identity not found in request context.');
  }

  return claims.sub;
}