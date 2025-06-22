import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { getConfig } from '@lambda/common/config/publicDatabase';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { getDbClient, getDbCredentials } from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';
import { QueryWithParams } from '@lambda/common/types';

import { queryParamSchema } from './schemas';


const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of the parsed request body.
 *
 * @template T - Type of the payload object.
 * @property category_id - The category of the content (used for routing logic).
 * @property payload - The validated content-specific payload to write.
 */
export interface QueryParameters {
  limit: number;
  search?: string;
}

/**
 * The main Lambda handler function that processes the read API Gateway request and queries the database.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response indicating success or failure.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let queryParameters: QueryParameters | undefined;

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    queryParameters = parseQueryParameters(event);
    const { search, limit } = queryParameters;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const query = createContentQuery(limit, search);
    const result = await db.query(query.sql, query.values);

    return createResponse(200, { results: result.rows }, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    }

    console.error('Error reading contents:', error, queryParameters);
    return createResponse(500, { message: 'Failed to read contents.' }, origin);
  }
};

/**
 * Parses the incoming API Gateway event to extract and validate the query parameters.
 *
 * @param event - The API Gateway event containing the request.
 * @returns The parsed and validated query parameters, or an error response if the input is invalid.
 * @throws {ValidationError} - Throws validation errors if the query params are invalid.
 */
function parseQueryParameters(event: APIGatewayProxyEvent): QueryParameters {
  if (!event.queryStringParameters) {
    throw new ValidationError('Query parameters are missing.');
  }

  const queryParameters = event.queryStringParameters || {};

  const { error, value } = queryParamSchema.validate(queryParameters);

  if (error) {
    throw new ValidationError('Invalid request: ' + error.details[0].message);
  }

  return value;
}

/**
 * Builds a SQL query to retrieve content records from the database,
 * optionally filtered by a search string on the title and limited by a result count.
 *
 * @param limit - The maximum number of results to return (validated upstream via Joi).
 * @param search - Optional case-insensitive substring to filter by title.
 * @returns A parameterized SQL query object for reading content.
 */
export function createContentQuery(
  limit: number,
  search?: string,
): QueryWithParams {
  const values: any[] = [];
  let sql =
    'SELECT content_id, title, category_id, created_at, parent_id FROM content';

  if (search) {
    sql += ' WHERE LOWER(title) LIKE $1';
    values.push(`%${search.toLowerCase()}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
  values.push(limit);

  return { sql, values };
}
