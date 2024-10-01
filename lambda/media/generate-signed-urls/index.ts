import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../../common/errors';
import { requestBodySchema } from './schemas';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * The name of the S3 Bucket to generate signed URLs for.
 */
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
/**
 * The time to live value (in seconds) for the generated signed urls.
 */
const S3_URL_TTL = Number(process.env.S3_URL_TTL);
/**
 * The CDN domain URL.
 */
const CDN_DOMAIN_URL = process.env.CDN_DOMAIN_URL;

// Validate Environment Variables
if (!S3_BUCKET_NAME) {
  throw new Error('S3_BUCKET_NAME environment variable is missing.');
}

if (isNaN(S3_URL_TTL)) {
  throw new Error('S3_URL_TTL environment variable is not a valid number');
}

if (!CDN_DOMAIN_URL) {
  throw new Error('CDN_DOMAIN_URL environment variable is missing.');
}

/**
 * Interface representing the metadata for each file that will be uploaded.
 *
 * @interface RequestBody
 * @property {string} fileName - The name of the file to be uploaded.
 * @property {string} contentType - The MIME content type of the file.
 * @property {string} userId - The ID of the user uploading the file.
 */
interface FileMetadata {
  fileName: string;
  contentType: string;
  userId: string;
}

/**
 * Interface representing the structure of the parsed request body.
 *
 * @interface RequestBody
 * @property {string} filesMetadata - An array containing metadata for each file to be uploaded.
 */
interface RequestBody {
  filesMetadata: Array<FileMetadata>;
}

/**
 * Lambda handler function responsible for generating signed S3 URLs for file uploads.
 *
 * @param {APIGatewayProxyEvent} event - The API Gateway event containing the request.
 * @returns {Promise<APIGatewayProxyResult>} - The response containing the signed URLs or an error message.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let requestBody: RequestBody | undefined;
  try {
    requestBody = parseRequestBody(event);

    const { filesMetadata } = requestBody;

    const signedUrlPromisesAndKeys = filesMetadata.map((fileMetadata) =>
      getSignedUrlPromiseAndKey(fileMetadata),
    );

    const signedUrlsAndKeys = await Promise.all(signedUrlPromisesAndKeys);

    return {
      statusCode: 200,
      body: JSON.stringify({
        signedUrlsAndKeys,
        cdnDomainUrl: CDN_DOMAIN_URL,
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
 * Generates a signed URL Promise for uploading a file to an S3 bucket using file metadata.
 *
 * @param {FileMetadata} fileMetadata - The metadata for the file to be uploaded.
 * @returns {Promise<string>} - The signed URL for uploading the file.
 */
async function getSignedUrlPromiseAndKey(fileMetadata: FileMetadata) {
  const { userId, fileName, contentType } = fileMetadata;

  const key = createKey(userId, fileName, contentType);

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: S3_URL_TTL,
  });

  return { uploadUrl, key };
}

/**
 * Creates a unique key (path) for storing the file in the S3 bucket.
 *
 * The key structure includes the userId, current year, month, and a UUID,
 * ensuring that each file has a unique key.
 *
 * @param {string} userId - The ID of the user uploading the file.
 * @param {string} fileName - The name of the file to be uploaded.
 * @returns {string} - The unique key for the file in the S3 bucket.
 */
function createKey(userId: string, fileName: string, contentType: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = uuidv4();
  return `user/${userId}/${year}/${month}/${uuid}_${fileName}`;
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
