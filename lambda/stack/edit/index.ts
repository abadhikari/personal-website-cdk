import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handleInvalidOrigin, retrieveOrigin } from '../../common/cors';
import { createResponse } from '../../common/createResponse';
import { ValidationError } from '../../common/errors';
import { getConfig } from './config';
import { requestBodySchema } from './schemas';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const { STACK_METADATA_TABLE, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of the parsed request body and query params.
 *
 * @interface RequestInput
 * @property {string} stackId - The unique identifier for the stack.
 * @property {string} caption - The caption that describes the stack.
 * @property {string} [location] - The optional location associated with the stack.
 */
interface RequestInput {
  stackId: string;
  caption?: string;
  location?: string;
}

/**
 * Handles an API Gateway PATCH request to update stack metadata.
 *
 * @param event - The API Gateway event containing the request and query parameters.
 * @returns A Promise that resolves to an API Gateway response indicating success or failure.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let requestInput: RequestInput | undefined;

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    const requestInput = parseRequestInput(event);

    const { stackId, caption, location } = requestInput;

    await editStackMetadata(stackId, caption, location);

    console.log(`Successfully updated stack ${stackId}`);

    return createResponse(
      200,
      {
        message: 'Data updated successfully!',
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

    console.error(
      `Error updating stack data for request with requestBody: ${requestInput && JSON.stringify(requestInput)} with error:`,
      error,
    );
    return createResponse(500, { message: 'Internal server error.' }, origin);
  }
};

/**
 * Extracts and validates input from API Gateway event (body + query params).
 *
 * @param event - The API Gateway event containing the request.
 * @returns The validated request payload containing stackId, caption, and/or location.
 * @throws ValidationError - If input is missing, malformed, or fails schema validation.
 */
function parseRequestInput(event: APIGatewayProxyEvent): RequestInput {
  try {
    if (!event.body) {
      throw new ValidationError('Request body is missing.');
    }

    const requestBody = JSON.parse(event.body);

    const queryParams = event.queryStringParameters || {};

    const payload = {
      stackId: queryParams.stackId,
      caption: requestBody.caption,
      location: requestBody.location,
    };

    const { error, value } = requestBodySchema.validate(payload);

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
 * Updates one or more metadata fields (caption, location) for a given stack in the Stack Metadata table.
 *
 * - This function performs a partial update using DynamoDB's UpdateExpression syntax.
 * - Fields not provided will remain unchanged.
 * - If neither caption nor location is provided, a ValidationError is thrown.
 *
 * @param {string} stackId - The unique identifier for the stack to update.
 * @param {string} [caption] - An optional new caption for the stack.
 * @param {string} [location] - An optional new location for the stack.
 * @returns {Promise<void>} Resolves when the update is successful.
 * @throws {ValidationError} If neither caption nor location is provided.
 * @throws {Error} If the DynamoDB update fails.
 */
async function editStackMetadata(
  stackId: string,
  caption?: string,
  location?: string,
): Promise<void> {
  const updateExpressions = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, string> = {};

  if (caption !== undefined) {
    updateExpressions.push('#caption = :caption');
    expressionAttributeNames['#caption'] = 'caption';
    expressionAttributeValues[':caption'] = caption;
  }

  if (location !== undefined) {
    updateExpressions.push('#location = :location');
    expressionAttributeNames['#location'] = 'location';
    expressionAttributeValues[':location'] = location;
  }

  const updateExpression = 'SET ' + updateExpressions.join(', ');

  const command = new UpdateCommand({
    TableName: STACK_METADATA_TABLE,
    Key: { stackId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await dynamoDbClient.send(command);
}
