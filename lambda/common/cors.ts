import { APIGatewayProxyEvent } from 'aws-lambda';

import { createResponse } from './createResponse';

/**
 * Extracts and normalizes the Origin header from an API Gateway event.
 *
 * This function retrieves the `Origin` header (case-insensitive) from the incoming
 * API Gateway event, trims any leading or trailing whitespace, and converts it
 * to lowercase for consistent processing.
 */
export function retrieveOrigin(event: APIGatewayProxyEvent): string {
  const origin = event.headers['Origin'] || event.headers['origin'] || '';
  return origin.trim().toLowerCase();
}

/**
 * Handles requests from invalid origins.
 *
 * @param {string} origin - The origin of the request that was blocked.
 * @returns {object} - A response object with a error status code and an error message.
 */
export function handleInvalidOrigin(origin: string) {
  console.warn(`Blocked request from unallowed origin: ${origin}`);
  return createResponse(403, { message: 'Forbidden: Invalid origin' }, origin);
}

/**
 * Deserializes the origin allowlist string into an array of origins.
 *
 * @param {string | undefined} originAllowlist - A comma-separated string of allowed origins.
 * @returns {string[] | undefined} - An array of allowed origins if the input is defined; otherwise, undefined.
 */
export function deserializeOriginAllowlist(
  originAllowlist: string | undefined,
) {
  return originAllowlist?.split(',');
}
