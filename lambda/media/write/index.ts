import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AWSError } from 'aws-sdk';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { ValidationError } from '../../common/errors';
import { requestBodySchema } from './schemas';

const dynamoDbClient = new DocumentClient();

/**
 * The name of the DynamoDB table that stores stack metadata.
 */
const STACK_METADATA_TABLE = process.env.STACK_METADATA_TABLE as string;
/**
 * The name of the DynamoDB table that stores media metadata.
 */
const MEDIA_METADATA_TABLE = process.env.MEDIA_METADATA_TABLE as string;

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
 * @property {ImageSrc} imageSrc - The source URLs for the media (thumbnail and full image).
 * @property {string} mediaType - The type of the media (e.g., image, video).
 */
interface Media {
  mediaId: string;
  alternativeText?: string;
  imageSrc: ImageSrc;
  mediaType: string;
}

/**
 * Interface representing the structure of image sources in the media of a parsed request body.
 *
 * @interface ImageSrc
 * @property {string} thumbnail - The URL of the thumbnail-sized image.
 * @property {string} full - The URL of the full-sized image.
 */
interface ImageSrc {
  thumbnail: string;
  full: string;
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
  try {
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

    return createResponse(200, 'Media metadata saved successfully!');
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(error.statusCode, error.message);
    }

    console.error('Error uploading media:', error);
    return createResponse(500, 'Failed to save metadata.');
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
 * Creates a standardized response for the API Gateway.
 *
 * @param statusCode - The HTTP status code.
 * @param message - The message to be returned in the response body.
 * @returns An object representing the API Gateway response.
 */
function createResponse(statusCode: number, message: string) {
  return {
    statusCode: statusCode,
    body: JSON.stringify({ message }),
  };
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
  params: DocumentClient.PutItemInput,
  idAttributeName: string,
): Promise<void> {
  const conditionalParams = {
    ...params,
    ConditionExpression: `attribute_not_exists(${idAttributeName})`,
  };

  try {
    await dynamoDbClient.put(conditionalParams).promise();
  } catch (error) {
    if ((error as AWSError).code === 'ConditionalCheckFailedException') {
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
  const { mediaId, alternativeText, imageSrc, mediaType } = media;
  const mediaMetadataParams = {
    TableName: MEDIA_METADATA_TABLE,
    Item: {
      mediaId,
      stackId,
      alternativeText,
      imageSrc,
      sequenceNumber,
      mediaType,
    },
  };
  return putItem(mediaMetadataParams, 'mediaId');
}
