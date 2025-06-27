import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { getConfig } from '@lambda/common/config/publicDatabase';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { getDbClient, getDbCredentials } from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';
import { retrieveUserIdFromEvent } from '@lambda/common/retrieveUserIdFromEvent';
import { QueryWithParams } from '@lambda/common/types';

import { requestSchema } from './schemas';

const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of the parsed review request body.
 *
 * @property contentId - UUID of the associated content.
 * @property ratingx2 - Rating from 1.0 to 5.0 in 0.5 steps (stored as 2–10).
 * @property reviewText - Non-empty string representing the review content.
 */
export interface RequestBody {
  contentId: string;
  ratingx2: number;
  reviewText: string;
}

/**
 * The main Lambda handler function that processes the write API Gateway request and queries the database
 * to insert a review.
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
    requestBody = parseRequestBody(event);
    const { contentId, ratingx2, reviewText } = requestBody;
    const userId = retrieveUserIdFromEvent(event);

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const query = createReviewInsertQuery(
      contentId,
      userId,
      ratingx2,
      reviewText,
    );
    await db.query(query.sql, query.values);

    return createResponse(
      200,
      {
        message: 'Review written successfully.',
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

    console.error('Error writing review:', error, requestBody);
    return createResponse(500, { message: 'Failed to write review.' }, origin);
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
 * Builds a SQL query to insert a review record into the database.
 *
 * @param request - The validated review request body containing contentId, userId, ratingx2, and reviewText.
 * @returns A parameterized SQL query object for inserting the review.
 */
function createReviewInsertQuery(
  contentId: string,
  userId: string,
  ratingx2: number,
  reviewText: string,
): QueryWithParams {
  const sql = `
    INSERT INTO reviews (content_id, user_id, rating_x2, review_text)
    VALUES ($1, $2, $3, $4)
  `;
  const values = [contentId, userId, ratingx2, reviewText];

  return { sql, values };
}
