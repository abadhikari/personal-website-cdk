import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { createResponse } from '@lambda/common/createResponse';
import { getDbClient, getDbCredentials } from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';

import { getConfig } from './config';
import { requestBodySchema } from './schemas';


const { DB_SECRET_ARN } = getConfig();

/**
 * Interface representing the structure of the parsed request body.
 *
 * @interface RequestBody
 * @property {string} query - The query to the database.
 */
interface RequestBody {
  query: string;
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
  let requestBody: RequestBody | APIGatewayProxyResult | undefined;

  try {
    requestBody = parseRequestBody(event);
    const { query } = requestBody;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const result = await db.query(query);

    return createResponse(200, {
      message: 'Query executed successfully.',
      result: result.rows,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(error.statusCode, { message: error.message });
    }

    console.error('Error executing query:', error);
    return createResponse(500, { message: 'Failed to execute query.' });
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
    const { error, value } = requestBodySchema.validate(requestBody);

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
