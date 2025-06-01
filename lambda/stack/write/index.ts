import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { handleInvalidOrigin, retrieveOrigin } from '../../common/cors';
import { createResponse } from '../../common/createResponse';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { getConfig } from './config';
import { requestBodySchema } from './schemas';
import { authenticateToken } from '../../common/auth';
import { ImagePath } from '../../common/types';

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const {
  STACK_METADATA_TABLE,
  MEDIA_METADATA_TABLE,
  ORIGIN_ALLOWLIST,
  STACK_METADATA_GSI_PARTITION_KEY,
  CDN_DOMAIN_URL,
  ADMIN_COGNITO_POOL_DOMAIN,
} = getConfig();

/**
 * Interface representing the structure of the parsed request body.
 *
 * @interface RequestBody
 * @property {string} stackId - The unique identifier for the stack.
 * @property {string} caption - The caption that describes the stack.
 * @property {number} uploadTimestamp - The timestamp of when the stack was uploaded.
 * @property {string} [location] - The optional location associated with the stack.
 * @property {Array<Media>} media - The media items associated with the stack.
 */
interface RequestBody {
  stackId: string;
  caption: string;
  uploadTimestamp: number;
  location?: string;
  media: Array<Media>;
}

/**
 * Interface representing the structure of a Media item in the parsed request body.
 *
 * @interface Media
 * @property {string} mediaId - The unique identifier for the media item.
 * @property {string} [alternativeText] - The optional alternative text for the media (for accessibility).
 * @property {ImagePath} imagePath - The S3 path for the media (thumbnail and full image).
 * @property {string} mediaType - The type of the media (e.g., image, video).
 */
interface Media {
  mediaId: string;
  alternativeText?: string;
  imagePath: ImagePath;
  mediaType: string;
}

/**
 * The main Lambda handler function that processes the read API Gateway request and writes stack and
 * media metadata to respective DynamoDB tables.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response indicating success or failure.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let requestBody: RequestBody | APIGatewayProxyResult | undefined;

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      return createResponse(
        401,
        { message: 'Unauthorized: Missing token' },
        origin,
      );
    }
    const token = authHeader.replace('Bearer ', '');
    await authenticateToken(token, ADMIN_COGNITO_POOL_DOMAIN);

    requestBody = parseRequestBody(event);
    const { stackId, caption, uploadTimestamp, location, media } = requestBody;
    const stackMetadataPromise = saveStackMetadata(
      stackId,
      caption,
      uploadTimestamp,
      location,
    );
    const mediaMetadataPromises = media.map((mediaItem, index) =>
      saveMediaMetadata(mediaItem, stackId, index),
    );

    await Promise.all([...mediaMetadataPromises, stackMetadataPromise]);

    return createResponse(
      200,
      { message: 'Media metadata saved successfully!' },
      origin,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    } else if (error instanceof UnauthorizedError) {
      console.error('Error authorizing:', error.message);
      return createResponse(
        error.statusCode,
        { message: 'Unauthorized' },
        origin,
      );
    }

    console.error('Error uploading media:', error);
    return createResponse(500, { message: 'Failed to save metadata.' }, origin);
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
    const { error, value } = requestBodySchema.validate(requestBody, {
      context: { currentTimestamp: Date.now() },
    });

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
 * Inserts an item into DynamoDB. Prevents overwriting existing items
 * with ConditionExpression and skips the put.
 *
 * @param params - The parameters for the DynamoDB `put` operation.
 * @param idAttributeName - The name of the unique attribute (e.g., mediaId or stackId).
 * @throws AWSError - the error that occurs during the DynamoDB operation.
 */
async function putItem(
  params: PutCommandInput,
  idAttributeName: string,
): Promise<void> {
  const conditionalParams = {
    ...params,
    ConditionExpression: `attribute_not_exists(${idAttributeName})`,
  };

  const command = new PutCommand(conditionalParams);

  try {
    await dynamoDbClient.send(command);
  } catch (error) {
    if ((error as Error).name === 'ConditionalCheckFailedException') {
      console.log(
        `Item with ${idAttributeName} already exists in ${params.TableName}, skipping.`,
      );
      return;
    }
    console.error(`Error putting item into ${params.TableName}.`);
    throw error;
  }
}

/**
 * Saves stack metadata to the DynamoDB table.
 *
 * @param stackId - The unique identifier for the stack.
 * @param caption - The caption that describes the stack.
 * @param uploadTimestamp - The timestamp of when the stack was uploaded.
 * @param location - The optional location associated with the stack.
 * @returns A Promise that resolves when the item is saved in DynamoDB.
 */
function saveStackMetadata(
  stackId: string,
  caption: string,
  uploadTimestamp: number,
  location: string | undefined,
) {
  const stackMetadataParams = {
    TableName: STACK_METADATA_TABLE,
    Item: {
      caption,
      stackId,
      location,
      uploadTimestamp,
      staticKey: STACK_METADATA_GSI_PARTITION_KEY,
    },
  };
  return putItem(stackMetadataParams, 'stackId');
}

/**
 * Saves media metadata to the DynamoDB table.
 *
 * @param media - The media metadata to be saved.
 * @param stackId - The unique identifier for the media.
 * @param sequenceNumber - The sequence number of the media in the stack.
 * @returns A Promise that resolves when the media item is saved in DynamoDB.
 */
function saveMediaMetadata(
  media: Media,
  stackId: string,
  sequenceNumber: number,
) {
  const { mediaId, alternativeText, imagePath, mediaType } = media;
  const imageUrl = constructImageUrl(imagePath);
  const mediaMetadataParams = {
    TableName: MEDIA_METADATA_TABLE,
    Item: {
      mediaId,
      stackId,
      alternativeText,
      imageUrl,
      sequenceNumber,
      mediaType,
    },
  };
  return putItem(mediaMetadataParams, 'mediaId');
}

/**
 * Constructs full CDN URLs for the provided image paths.
 *
 * @param {ImagePath} imagePath - The paths to the thumbnail and full images in S3.
 * @returns {ImagePath} - The constructed full URLs for both thumbnail and full images.
 */
function constructImageUrl(imagePath: { thumbnail: string; full: string }) {
  const urlProtocol = 'https';
  return {
    thumbnail: `${urlProtocol}://${CDN_DOMAIN_URL}/${imagePath.thumbnail}`,
    full: `${urlProtocol}://${CDN_DOMAIN_URL}/${imagePath.full}`,
  };
}
