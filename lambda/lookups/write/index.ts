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

import { requestSchema } from './schemas';

const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of the parsed review request body.
 *
 * @property lookupType - The type of lookup table to query (e.g., 'cuisine', 'genre').
 * @property newValue - The new lookup value to write.
 */
export interface RequestBody {
  lookupType: LookupType;
  newValue: string;
}

/**
 * Represents a single row returned from a lookup table query.
 */
type LookupRow = Record<string, string | number> & { name: string };

/**
 * The main Lambda handler function that processes the write API Gateway request and insert
 * the new lookup value into the specified table.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response indicating success or failure.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let requestBody: RequestBody | undefined;

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    requestBody = parseRequestBody(event);
    const { lookupType, newValue } = requestBody;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const lookupMetadata = getLookupMetadata(lookupType);

    const sqlQuery = createLookupInsertQuery(lookupMetadata, newValue);
    const result = await db.query(sqlQuery.sql, sqlQuery.values);
    const row = result.rows[0];

    const statusCode = row ? 201 : 200;
    return createResponse(
      statusCode,
      {
        message: row
          ? 'Lookup value written successfully.'
          : 'Lookup value already exists.',
        item: row ? formatLookupItem(row, lookupMetadata) : null,
      },
      origin,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    }

    console.error('Error writing lookup value:', error, requestBody);
    return createResponse(
      500,
      { message: 'Failed to write lookup value.' },
      origin,
    );
  }
};

/**
 * Parses the incoming API Gateway event to extract and validate the request body.
 *
 * @param event - The API Gateway event containing the request.
 * @returns The parsed and validated request body, or an error response if the input is invalid.
 * @throws ValidationError - If the request body is missing, invalid, or improperly formatted.
 */
function parseRequestBody(event: APIGatewayProxyEvent): RequestBody {
  try {
    if (!event.body) {
      throw new ValidationError('Request body is missing.');
    }

    const requestBody = JSON.parse(event.body);

    const { error, value } = requestSchema.validate(requestBody);
    if (error) {
      throw new ValidationError('Invalid request: ' + error.details[0].message);
    }

    return value;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError('Invalid JSON format.');
    }
    throw error;
  }
}

/**
 * Builds a SQL query to insert a new lookup value into the specified table.
 *
 * @param lookupMetadata - Metadata for the target lookup table, including its name.
 * @param newValue - The new lookup value to write.
 * @returns QueryWithParams containing the SQL string and associated values.
 */
export function createLookupInsertQuery(
  lookupMetadata: LookupMetadata,
  newValue: string,
): QueryWithParams {
  const { table } = lookupMetadata;
  return {
    sql: `INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`,
    values: [newValue],
  };
}

/**
 * Formats a database row from a lookup table into a standardized response shape.
 *
 * This function dynamically uses the correct ID column (as defined in the lookup metadata)
 * to extract the lookup item's identifier along with its name.
 *
 * @param row - A raw row object returned from the database query.
 * @param lookupMetadata - Metadata containing the dynamic ID column name for the lookup table.
 * @returns An object containing the `id` and `name` of the inserted or existing lookup value.
 */
function formatLookupItem(row: LookupRow, lookupMetadata: LookupMetadata) {
  const { idColumn } = lookupMetadata;
  return {
    id: row[idColumn],
    name: row.name,
  };
}
