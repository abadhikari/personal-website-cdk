import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ValidationError } from '../../common/errors';
import { requestBodySchema } from './schemas';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * The name of the DynamoDB table that stores stack metadata.
 */
const STACK_METADATA_TABLE = process.env.STACK_METADATA_TABLE as string;
/**
 * The name of the Global Secondary Index (GSI) used to query stack metadata by upload timestamp.
 */
const STACK_METADATA_GSI = process.env.STACK_METADATA_GSI as string;
/**
 * The name of the DynamoDB table that stores media metadata.
 */
const MEDIA_METADATA_TABLE = process.env.MEDIA_METADATA_TABLE as string;
/**
 * The name of the Global Secondary Index (GSI) used to query media metadata by stack ID.
 */
const MEDIA_METADATA_GSI = process.env.MEDIA_METADATA_GSI as string;

// Validate Environment Variables
if (!STACK_METADATA_TABLE) {
  throw new Error('STACK_METADATA_TABLE environment variable is missing.');
}

if (!STACK_METADATA_GSI) {
  throw new Error('STACK_METADATA_GSI environment variable is missing.');
}

if (!MEDIA_METADATA_TABLE) {
  throw new Error('MEDIA_METADATA_TABLE environment variable is missing.');
}

if (!MEDIA_METADATA_GSI) {
  throw new Error('MEDIA_METADATA_GSI environment variable is missing.');
}

/**
 * Interface representing the structure of the parsed request body.
 *
 * @interface RequestBody
 * @property {string} stackLimit - The number of max number of stacks.
 * @property {number} startTimestamp - The starting timestamp for the time range.
 * @property {number} endTimestamp - The ending timestamp for the time range.
 */
interface RequestBody {
  stackLimit: number;
  startTimestamp: number;
  endTimestamp: number;
}

/**
 * The main Lambda handler function that processes the read API Gateway request, queries DynamoDB for stack and media metadata,
 * and returns the combined result in a display-ready format with a list of stacks and corresponding media of the stacks.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response with the stack and media metadata.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let requestBody: RequestBody | undefined;
  try {
    requestBody = parseRequestBody(event);

    const { stackLimit, startTimestamp, endTimestamp } = requestBody;

    // Query StackMetadata table using GSI to get the stackLimit most recent stacks
    const stackMetadataResponse = await queryStackMetadataTable(
      stackLimit,
      startTimestamp,
      endTimestamp,
    );

    const stacks = stackMetadataResponse.Items || [];
    if (stacks.length === 0) {
      return createErrorResponse(404, 'No stacks found!');
    }

    // For each stack, query the MediaMetadata table in parallel
    const mediaPromises = stacks.map((stack) => {
      if (!stack.stackId) {
        throw new Error('stackId field is missing from stack');
      }
      return queryMediaMetadataTable(stack.stackId);
    });

    // Resolve all media queries in parallel
    const mediaResponses = await Promise.all(mediaPromises);

    // Combine the results from both queries into display ready object
    const stackAndMediaData = stacks.map((stack, index) => ({
      stack,
      media: mediaResponses[index].Items,
    }));

    // Return the successful response
    return {
      statusCode: 200,
      body: JSON.stringify({
        stackAndMediaData,
      }),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.statusCode, error.message);
    }

    console.error(
      `Error fetching media data for request ${JSON.stringify(requestBody)} with error:`,
      error,
    );
    return createErrorResponse(500, 'Internal server error.');
  }
};

/**
 * Parses the incoming API Gateway event to extract and validate the request body.
 *
 * @param event - The API Gateway event containing the request.
 * @returns The parsed and validated request body, or an error response if the input is invalid.
 * @throws {ValidationError} - Throws validation errors if the request body is invalid.
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

/**
 * Creates a standardized error response for the API.
 *
 * @param statusCode - The HTTP status code for the error.
 * @param message - The error message to be returned in the response body.
 * @returns An object representing the API Gateway error response.
 */
function createErrorResponse(statusCode: number, message: string) {
  return {
    statusCode: statusCode,
    body: JSON.stringify({ message }),
  };
}

/**
 * Queries the StackMetadata DynamoDB table to retrieve the most recent stacks within a given time range.
 *
 * @param limit - The maximum number of stacks to retrieve.
 * @param startTimestamp - The start of the timestamp range for querying.
 * @param endTimestamp - The end of the timestamp range for querying.
 * @returns A Promise that resolves to the query result containing the stack metadata.
 */
async function queryStackMetadataTable(
  limit: number,
  startTimestamp: number,
  endTimestamp: number,
) {
  const params = {
    TableName: STACK_METADATA_TABLE,
    IndexName: STACK_METADATA_GSI,
    Limit: limit,
    ScanIndexForward: false, // Sort by most recent (descending order)
    KeyConditionExpression: 'uploadTimestamp BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':start': startTimestamp,
      ':end': endTimestamp,
    },
  };
  const command = new QueryCommand(params);
  return await dynamoDbClient.send(command);
}

/**
 * Queries the MediaMetadata DynamoDB table to retrieve media metadata for a given stack ID.
 *
 * @param stackId - The stack ID for which media metadata is being queried.
 * @returns A Promise that resolves to the query result containing the media metadata.
 */
async function queryMediaMetadataTable(stackId: string) {
  const params = {
    TableName: MEDIA_METADATA_TABLE,
    IndexName: MEDIA_METADATA_GSI,
    KeyConditionExpression: 'stackId = :stackId',
    ExpressionAttributeValues: {
      ':stackId': stackId,
    },
  };
  const command = new QueryCommand(params);
  return await dynamoDbClient.send(command);
}
