import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { ValidationError } from '@lambda/common/errors';
import { getConfig } from './config';
import { queryParametersSchema } from './schemas';
import { queryMediaMetadataTable } from '@lambda/common/queryMediaMetadataTable';
import { decode, encode } from '@lambda/common/string';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const {
  STACK_METADATA_TABLE,
  STACK_METADATA_GSI,
  MEDIA_METADATA_TABLE,
  MEDIA_METADATA_GSI,
  ORIGIN_ALLOWLIST,
  STACK_METADATA_GSI_PARTITION_KEY,
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
 * @property {string} stackLimit - The number of max number of stacks.
 * @property {number} startTimestamp - The starting timestamp for the time range.
 * @property {number} endTimestamp - The ending timestamp for the time range.
 */
interface QueryParameters {
  stackLimit: number;
  startTimestamp: number;
  endTimestamp: number;
  lastEvaluatedKey?: string;
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
  let queryParameters: QueryParameters | undefined;

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    queryParameters = parseQueryParams(event);

    const { stackLimit, startTimestamp, endTimestamp, lastEvaluatedKey } =
      queryParameters;

    // Query StackMetadata table using GSI to get the stackLimit most recent stacks
    const stackMetadataResponse = await queryStackMetadataTable(
      stackLimit,
      startTimestamp,
      endTimestamp,
      lastEvaluatedKey,
    );

    // If no stacks are returned, return early with an empty result.
    // This avoids unnecessary media queries and signals pagination is complete.
    const stacks = stackMetadataResponse.Items || [];
    if (stacks.length === 0) {
      return createResponse(
        200,
        { stackAndMediaData: [], lastEvaluatedKey: null },
        origin,
      );
    }

    // For each stack, query the MediaMetadata table in parallel
    const mediaPromises = stacks.map((stack) => {
      if (!stack.stackId) {
        throw new Error('stackId field is missing from stack');
      }
      return queryMediaMetadataTable(
        dynamoDbClient,
        stack.stackId,
        MEDIA_METADATA_TABLE,
        MEDIA_METADATA_GSI,
      );
    });

    // Resolve all media queries in parallel
    const mediaResponses = await Promise.all(mediaPromises);

    // Combine the results from both queries into display ready object
    const stackAndMediaData = stacks.map((stack, index) => ({
      stack,
      media: mediaResponses[index].Items,
    }));

    // Return the successful response
    return createResponse(
      200,
      {
        stackAndMediaData,
        lastEvaluatedKey: stackMetadataResponse.LastEvaluatedKey
          ? encode(stackMetadataResponse.LastEvaluatedKey)
          : null,
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
  lastEvaluatedKey?: string,
) {
  const params = {
    TableName: STACK_METADATA_TABLE,
    IndexName: STACK_METADATA_GSI,
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey ? decode(lastEvaluatedKey) : undefined,
    ScanIndexForward: false, // Sort by most recent (descending order)
    KeyConditionExpression:
      'staticKey = :staticKey AND uploadTimestamp BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':staticKey': STACK_METADATA_GSI_PARTITION_KEY,
      ':start': startTimestamp,
      ':end': endTimestamp,
    },
    ProjectionExpression: EXPECTED_STACK_METADATA_FIELDS.join(', '),
    ExpressionAttributeNames: EXPRESSION_ATTRIBUTE_NAMES,
  };
  const command = new QueryCommand(params);
  return await dynamoDbClient.send(command);
}
