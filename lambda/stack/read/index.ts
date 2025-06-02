import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handleInvalidOrigin, retrieveOrigin } from '../../common/cors';
import { createResponse } from '../../common/createResponse';
import { ValidationError } from '../../common/errors';
import { getConfig } from './config';
import { queryParametersSchema } from './schemas';
import { queryMediaMetadataTable } from '../../common/queryMediaMetadataTable';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const {
  STACK_METADATA_TABLE,
  MEDIA_METADATA_TABLE,
  MEDIA_METADATA_GSI,
  ORIGIN_ALLOWLIST,
} = getConfig();

/**
 * The fields that we want from querying the stack metadata table. This will
 * exclude the staticKey field which is unwanted. Also ensures we know exactly
 * what will come from dynamodb, adding an extra layer of security.
 */
const EXPECTED_STACK_METADATA_FIELDS = [
  'stackId',
  'caption',
  '#loc',
  'uploadTimestamp',
];

/**
 * Dynamodb reserves certain keywords. To avoid errors for expecting fields
 * that conflict with these keywords, have to substitute them temporarily.
 */
const EXPRESSION_ATTRIBUTE_NAMES = {
  '#loc': 'location',
};

/**
 * Interface representing the structure of the query parameters.
 *
 * @interface QueryParameters
 * @property {string} stackId - The specific stackId to retrieve.
 */
interface QueryParameters {
  stackId: string;
}

/**
 * The main Lambda handler function that processes the read API Gateway request, queries DynamoDB for the specific stack and media metadata,
 * and returns the combined result in a display-ready format with a stack and its corresponding media.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response with the stack and media metadata.
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
    queryParameters = parseQueryParams(event);

    const { stackId } = queryParameters;

    const stack = await getStackMetadataById(stackId);

    if (!stack) {
      return createResponse(404, { message: 'Stack not found.' }, origin);
    }

    // Query the media associated with the stack
    const media = await queryMediaMetadataTable(
      dynamoDbClient,
      stackId,
      MEDIA_METADATA_TABLE,
      MEDIA_METADATA_GSI,
    );

    return createResponse(
      200,
      {
        stackAndMediaData: {
          stack,
          media: media.Items ?? [],
        },
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
      `Error fetching media data for request with queryParameters: ${queryParameters && JSON.stringify(queryParameters)} with error:`,
      error,
    );
    return createResponse(500, { message: 'Internal server error.' }, origin);
  }
};

/**
 * Parses the incoming API Gateway event to extract and validate the query parameters.
 *
 * @param event - The API Gateway event containing the request.
 * @returns The parsed and validated query parameters, or an error response if the input is invalid.
 * @throws {ValidationError} - Throws validation errors if the query params are invalid.
 */
function parseQueryParams(event: APIGatewayProxyEvent): QueryParameters {
  if (!event.queryStringParameters) {
    throw new ValidationError('Query parameters are missing.');
  }

  const queryParameters = event.queryStringParameters || {};

  const { error, value } = queryParametersSchema.validate(queryParameters);

  if (error) {
    throw new ValidationError('Invalid request: ' + error.details[0].message);
  }

  return value;
}

/**
 * Queries the StackMetadata DynamoDB table to retrieve the specific stack associated with the stackId.
 *
 * @param stackId - the identifier of the stack.
 * @returns A Promise that resolves to the query result containing the stack metadata.
 */
async function getStackMetadataById(stackId: string) {
  const params = {
    TableName: STACK_METADATA_TABLE,
    Key: {
      stackId,
    },
    ProjectionExpression: EXPECTED_STACK_METADATA_FIELDS.join(', '),
    ExpressionAttributeNames: EXPRESSION_ATTRIBUTE_NAMES,
  };
  const command = new GetCommand(params);
  const result = await dynamoDbClient.send(command);
  return result.Item ?? null;
}
