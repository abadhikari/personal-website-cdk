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
 * Interface representing the validated query parameters for the reviews read request.
 *
 * @property limit - Maximum number of results to return (validated upstream via Joi).
 * @property search - Optional case-insensitive substring to filter reviews by title.
 * @property cursor - Optional ISO 8601 timestamp string used for pagination. Filters reviews created before this timestamp.
 */
export interface QueryParameters {
  limit: number;
  search?: string;
  cursor?: string;
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
    const { search, limit, cursor } = queryParameters;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const query = createReviewQuery(limit, search, cursor);
    const result = await db.query(query.sql, query.values);

    const rows = result.rows;
    const nextCursor = rows.length > 0
      ? new Date(rows[rows.length - 1].created_at).toISOString()
      : null;

    return createResponse(200, { results: rows, nextCursor }, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    }

    console.error('Error reading reviews:', error, queryParameters);
    return createResponse(500, { message: 'Failed to read reviews.' }, origin);
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
 * Builds a SQL query to retrieve review records from the database,
 * optionally filtered by a search string on the title and limited by a result count.
 *
 * @param limit - The maximum number of results to return (validated upstream via Joi).
 * @param search - Optional case-insensitive substring to filter by title.
 * @param cursor - Optional ISO timestamp string to paginate results. Only reviews
 *              created *before* this timestamp will be returned. Used for
 *              infinite scroll or cursor-based pagination.
 * @returns A parameterized SQL query object for reading reviews.
 */
export function createReviewQuery(
  limit: number,
  search?: string,
  cursor?: string,
): QueryWithParams {
  let sql = 'SELECT review_id, title, rating, created_at FROM reviews';

  const { whereClause, values } = createWhereClause(search, cursor);

  sql += whereClause;
  sql += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
  values.push(limit);

  return { sql, values };
}

/**
 * Constructs a dynamic SQL WHERE clause and corresponding parameter values
 * based on optional search and cursor filters.
 *
 * @param search - Optional case-insensitive substring to match against the title field.
 *                 Converted to lowercase and wrapped with wildcards for partial matching.
 * @param cursor - Optional ISO timestamp string to filter out records created after this point.
 *
 * @returns An object containing:
 *   - `whereClause`: A SQL WHERE clause string (empty if no filters provided),
 *   - `values`: An ordered array of parameter values that match the placeholders in the clause.
 */
function createWhereClause(search?: string, cursor?: string) {
  const conditions = [];
  const values: any[] = [];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`LOWER(title) LIKE $${values.length}`);
  }

  if (cursor) {
    values.push(cursor);
    conditions.push(`created_at < $${values.length}`);
  }

  const whereClause = values.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}
