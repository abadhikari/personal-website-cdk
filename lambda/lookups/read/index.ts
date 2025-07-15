import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { getConfig } from '@lambda/common/config/publicDatabase';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { getDbClient, getDbCredentials } from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';
import {
  getLookupMetadata,
  LookupMetadata,
} from '@lambda/common/lookupMetadata';
import { LookupType, QueryWithParams } from '@lambda/common/types';

import { queryParamSchema } from './schemas';

const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of parsed and validated query parameters.
 *
 * @property lookupType - The type of lookup table to query (e.g., 'cuisine', 'genre').
 * @property query - Optional case-insensitive search string to filter names.
 */
export interface QueryParameters {
  lookupType: LookupType;
  query?: string;
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
    const { lookupType, query } = queryParameters;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const lookupMetadata = getLookupMetadata(lookupType);

    const sqlQuery = createLookupQuery(lookupMetadata, query);
    const result = await db.query(sqlQuery.sql, sqlQuery.values);

    return createResponse(200, { results: result.rows }, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    }

    console.error('Error reading lookups:', error, queryParameters);
    return createResponse(500, { message: 'Failed to read lookups.' }, origin);
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
 * Builds a SQL query to retrieve lookup records from the database,
 *
 * @param lookupMetadata - Metadata for the target lookup table, including its name.
 * @param query - Optional search string to filter results by name prefix.
 * @returns QueryWithParams containing the SQL string and associated values.
 */
export function createLookupQuery(
  lookupMetadata: LookupMetadata,
  query?: string,
): QueryWithParams {
  const { table, idColumn } = lookupMetadata;
  const values: string[] = [];
  let sql = `SELECT ${idColumn} AS id, name FROM ${table}`;

  if (query) {
    sql += ' WHERE name ILIKE $1';
    values.push(`${query}%`);
  }
  return { sql, values };
}
