import { DynamoDBClient, QueryCommandOutput } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { ValidationError } from '@lambda/common/errors';
import { queryMediaMetadataTable } from '@lambda/common/queryMediaMetadataTable';
import { ImagePath } from '@lambda/common/types';

import { getConfig } from './config';
import { queryParametersSchema } from './schemas';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const {
  STACK_METADATA_TABLE,
  MEDIA_METADATA_TABLE,
  MEDIA_METADATA_GSI,
  ORIGIN_ALLOWLIST,
  S3_BUCKET_NAME,
} = getConfig();

/**
 * Interface representing the structure of the query parameters.
 *
 * @interface QueryParameters
 * @property {string} mediaId - The unique identifier for the media item.
 * @property {string} stackId - The unique identifier for the stack item.
 */
interface QueryParameters {
  mediaId?: string;
  stackId: string;
}

export interface PartialMedia {
  mediaId: string;
  imageUrl: ImagePath;
}

/**
 * Handles an API Gateway DELETE request by validating query parameters,
 * querying media metadata from DynamoDB, and performing deletion of one or more media items.
 * If the deleted media item is the last in its stack, the stack entry is also deleted.
 *
 * @param event - The API Gateway event containing the request and query parameters.
 * @returns A Promise that resolves to an API Gateway response indicating success or failure.
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

    const { stackId, mediaId } = queryParameters;

    await deleteMedia(stackId, mediaId);

    return createResponse(
      200,
      {
        message: 'Data deleted successfully!',
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
      `Error deleting media data for request with queryParameters: ${queryParameters && JSON.stringify(queryParameters)} with error:`,
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

  const { error, value } = queryParametersSchema.validate(
    event.queryStringParameters,
  );

  if (error) {
    throw new ValidationError('Invalid request: ' + error.details[0].message);
  }

  return value;
}

/**
 * Deletes one or more media items from the media metadata table, and deletes the associated stack if it is the last media item.
 * Uses a DynamoDB transaction to ensure atomicity of all delete operations.
 *
 * @param stackId - The unique identifier for the stack.
 * @param mediaId - (Optional) The specific media ID to delete. If omitted, all media in the stack will be deleted.
 * @throws {Error} - Throws if no valid media IDs are provided for deletion.
 */
async function deleteMedia(stackId: string, mediaId?: string) {
  const deletes = [];

  const mediaQueryResponse = await queryMediaMetadataTable(
    dynamoDbClient,
    stackId,
    MEDIA_METADATA_TABLE,
    MEDIA_METADATA_GSI,
  );

  const mediaItems = extractMediaItems(mediaQueryResponse);

  const mediaIds = mediaItems.map((m) => m.mediaId);

  // If a specific mediaId is provided, delete only that item. Otherwise, delete all media in the stack.
  const mediaToDelete = mediaId ? [mediaId] : mediaIds;

  for (const id of mediaToDelete) {
    deletes.push({
      Delete: {
        TableName: MEDIA_METADATA_TABLE,
        Key: { mediaId: id },
      },
    });
  }

  // If this is the last media, also delete the stack
  if (mediaIds.length === 1) {
    deletes.push({
      Delete: {
        TableName: STACK_METADATA_TABLE,
        Key: { stackId: stackId },
      },
    });
  }

  const command = new TransactWriteCommand({
    TransactItems: deletes,
  });

  await dynamoDbClient.send(command);

  await deleteMediaItemsFromS3(mediaItems, mediaId);
}

/**
 * Extracts media IDs from a DynamoDB query response.
 * Validates that the response contains media items and that each item includes a valid mediaId.
 *
 * @param mediaResponse - The raw DynamoDB query response containing media items.
 * @returns An array of mediaId strings.
 * @throws {Error} - Throws if no media items are found or if a media item is missing a valid mediaId.
 */
function extractMediaItems(mediaResponse: QueryCommandOutput): PartialMedia[] {
  const media = mediaResponse.Items;
  if (!media || media.length === 0) {
    throw new Error('No media items found.');
  }

  return media.map((item) => {
    if (typeof item.mediaId !== 'string' || !item.imageUrl) {
      throw new Error('Invalid media item: missing required fields');
    }
    return item as unknown as PartialMedia;
  });
}

/**
 * Deletes media items from S3 based on the provided media list.
 * If a specific mediaId is provided, only that item's imagePath is deleted.
 * Otherwise, all imagePaths in the list are deleted.
 *
 * @param mediaItems - The list of Media items containing image paths.
 * @param mediaId - (Optional) The specific mediaId to delete. If not provided, all mediaItems will be deleted.
 * @throws {Error} - Throws if the specified mediaId is not found in the list.
 */
async function deleteMediaItemsFromS3(
  mediaItems: PartialMedia[],
  mediaId?: string,
) {
  let imagePaths: ImagePath[];

  if (mediaId) {
    const match = mediaItems.find((item) => item.mediaId === mediaId);

    if (!match || !match.imageUrl) {
      throw new Error(`No media item found for mediaId: ${mediaId}`);
    }

    imagePaths = [match.imageUrl];
  } else {
    imagePaths = mediaItems.map((item) => item.imageUrl);
  }

  await Promise.all(
    imagePaths.map(async (imagePath) => {
      try {
        await deleteMediaFromS3(imagePath);
      } catch (err) {
        console.error('Failed to delete from S3:', imagePath, err);
      }
    }),
  );
}

/**
 * Deletes full and thumbnail media files from S3 based on the provided paths.
 *
 * @param imagePath - Object containing full and thumbnail CDN URLs
 */
async function deleteMediaFromS3(imagePath: ImagePath) {
  const keysToDelete = [
    getS3KeyFromCdnUrl(imagePath.full),
    getS3KeyFromCdnUrl(imagePath.thumbnail),
  ];

  const deletePromises = keysToDelete.map((key) =>
    s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      }),
    ),
  );

  console.log('Deleting media from S3:', keysToDelete);

  await Promise.all(deletePromises);
}

/**
 * Extracts the S3 object key from a CloudFront CDN URL.
 * Assumes that the URL path after the domain is the S3 key.
 *
 * @param cdnUrl - The full CloudFront CDN URL
 * @returns The corresponding S3 object key
 */
function getS3KeyFromCdnUrl(cdnUrl: string): string {
  try {
    const { pathname } = new URL(cdnUrl);
    return pathname.startsWith('/') ? pathname.slice(1) : pathname;
  } catch {
    throw new Error(`Invalid CDN URL: ${cdnUrl}`);
  }
}
