import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client as PgClient } from 'pg';

import { getConfig } from '@lambda/common/config/publicDatabase';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import {
  executeAtomicTransaction,
  getDbClient,
  getDbCredentials,
  replacePlaceholders,
} from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';
import {
  ContentCategory,
  ContentCategoryType,
  QueryWithParams,
} from '@lambda/common/types';

import { baseRequestSchema, retrieveSchemaForCategory } from './schemas';

const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the structure of the parsed request body.
 *
 * @template T - Type of the content-specific payload.
 * @property categoryId - The content category identifier.
 * @property payload - The content-specific validated payload.
 */
export interface RequestBody<T = any> {
  categoryId: ContentCategoryType;
  payload: T;
}

interface ExperiencePayload {
  title: string;
  address: string;
  city: string;
  state?: string;
  venueId: number;
  country: string;
  latitude: number;
  longitude: number;
  priceLevel: number;
  cuisineIds?: number[];
  dishIds?: number[];
  genreIds?: number[];
}

interface BookPayload {
  title: string;
  author: string;
  pages: number;
  yearPublished: number;
  isbn?: string;
  genreIds: number[];
}

const CONTENT_ID_PLACEHOLDER = ':CONTENT_ID';

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

  const origin = retrieveOrigin(event);
  if (!ORIGIN_ALLOWLIST.includes(origin)) {
    return handleInvalidOrigin(origin);
  }

  try {
    requestBody = parseRequestBody(event);
    const { categoryId, payload } = requestBody;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const queries = await createWriteContentQueries(categoryId, payload);

    await executeAtomicTransaction(db, queries, executeContentTransaction);

    return createResponse(
      200,
      {
        message: 'Content written successfully.',
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

    console.error('Error writing content:', error, requestBody);
    return createResponse(500, { message: 'Failed to write content.' }, origin);
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

    const { error: baseError, value: baseValue } =
      baseRequestSchema.validate(requestBody);
    if (baseError) {
      throw new ValidationError(
        'Invalid request: ' + baseError.details[0].message,
      );
    }

    const { categoryId, payload } = baseValue;

    const payloadSchema = retrieveSchemaForCategory(categoryId);
    if (!payloadSchema) {
      throw new ValidationError(`Unsupported category: ${categoryId}`);
    }

    const { error: payloadError, value: validatedPayload } =
      payloadSchema.validate(payload);
    if (payloadError) {
      throw new ValidationError(
        'Invalid payload: ' + payloadError.details[0].message,
      );
    }

    return { categoryId, payload: validatedPayload };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError('Invalid JSON format.');
    }
    throw error;
  }
}

/**
 * Builds a list of SQL queries needed to persist content to the database
 * based on the provided content category and payload.
 *
 * @param categoryId - The category of the content being written.
 * @param payload - The validated payload object for the content.
 * @returns An ordered list of parameterized SQL queries.
 * @throws ValidationError - If the category is unsupported.
 */
export function createWriteContentQueries(
  categoryId: ContentCategoryType,
  payload: any,
): QueryWithParams[] {
  switch (categoryId) {
    case ContentCategory.BOOK:
      return buildBookQuery(categoryId, payload as BookPayload);
    case ContentCategory.FOOD_AND_DRINK:
      return buildFoodAndDrinkQuery(categoryId, payload as ExperiencePayload);
    case ContentCategory.ENTERTAINMENT:
      return buildEntertainmentQuery(categoryId, payload as ExperiencePayload);

    default:
      throw new ValidationError(`Unsupported categoryId: ${categoryId}`);
  }
}

function buildBookQuery(
  categoryId: ContentCategoryType,
  payload: BookPayload,
): QueryWithParams[] {
  const { title, genreIds = [] } = payload;
  const queries: QueryWithParams[] = [];

  const contentInsert = createContentInsertQuery(categoryId, title);
  queries.push(contentInsert);

  const bookInsert = createBooksInsertQuery(payload);
  queries.push(bookInsert);

  if (genreIds.length) {
    const genreInsert = createIdsInsertQuery('media_genres', 'media_genre_id', genreIds);

    queries.push(genreInsert);
  }

  return queries;
}

function createBooksInsertQuery(payload: BookPayload): QueryWithParams {
  const { title, author, pages, yearPublished: yearPublished, isbn } = payload;
  return {
    sql: `INSERT INTO books (
             content_id, title, author, pages, year_published, isbn
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [
      CONTENT_ID_PLACEHOLDER,
      title,
      author,
      pages,
      yearPublished,
      isbn ?? null,
    ],
  };
}

/**
 * Builds queries for FOOD_AND_DRINK content.
 *
 * @param categoryId - Content category, should be FOOD_AND_DRINK.
 * @param payload - Experience payload object.
 * @returns Query list for content, experience, and cuisine inserts.
 */
function buildFoodAndDrinkQuery(
  categoryId: ContentCategoryType,
  payload: ExperiencePayload,
): QueryWithParams[] {
  const { cuisineIds = [], dishIds = [], title } = payload;
  const queries: QueryWithParams[] = [];

  const contentInsert = createContentInsertQuery(categoryId, title);
  queries.push(contentInsert);

  const experienceInsert = createExperiencesInsertQuery(payload);
  queries.push(experienceInsert);

  if (cuisineIds.length) {
    const cuisineInsert = createIdsInsertQuery('experiences_cuisines', 'cuisine_id', cuisineIds);
    queries.push(cuisineInsert);
  }

  if (dishIds.length) {
    const dishInsert = createIdsInsertQuery('experiences_dishes', 'dish_id', dishIds);
    queries.push(dishInsert);
  }

  return queries;
}

/**
 * Builds queries for ENTERTAINMENT content.
 *
 * @param categoryId - Content category, should be ENTERTAINMENT.
 * @param payload - Experience payload object.
 * @returns Query list for content and experience inserts.
 */
function buildEntertainmentQuery(
  categoryId: ContentCategoryType,
  payload: ExperiencePayload,
): QueryWithParams[] {
  const { genreIds = [] } = payload;
  const queries: QueryWithParams[] = [];

  const contentInsert = createContentInsertQuery(categoryId, payload.title);
  queries.push(contentInsert);

  if (genreIds.length) {
    const genreInsert = createIdsInsertQuery('experiences_genres', 'experience_genre_id', genreIds);
    queries.push(genreInsert);
  }

  const experienceInsert = createExperiencesInsertQuery(payload);
  queries.push(experienceInsert);
  return queries;
}

/**
 * Creates the SQL query to insert a new contents row and return its ID.
 *
 * @param categoryId - The content category (e.g., FOOD_AND_DRINK).
 * @returns A parameterized SQL insert query to create a content row with RETURNING content_id.
 */
function createContentInsertQuery(
  categoryId: ContentCategoryType,
  title: string,
): QueryWithParams {
  return {
    sql: `INSERT INTO contents (category_id, title) VALUES ($1, $2) RETURNING content_id`,
    values: [categoryId, title],
  };
}

/**
 * Creates the SQL query to insert an experience row.
 * The content_id is patched later in the transaction.
 *
 * @param payload - Validated experience payload.
 * @returns A parameterized SQL insert query for the experiences table.
 */
function createExperiencesInsertQuery(
  payload: ExperiencePayload,
): QueryWithParams {
  const {
    title,
    address,
    city,
    state,
    venueId,
    country,
    latitude,
    longitude,
    priceLevel,
  } = payload;
  return {
    sql: `INSERT INTO experiences (
             content_id, title, address, city, state, venue_id, country, latitude, longitude, price_level
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    values: [
      CONTENT_ID_PLACEHOLDER,
      title,
      address,
      city,
      state ?? null,
      venueId,
      country,
      latitude,
      longitude,
      priceLevel,
    ],
  };
}

/**
 * Creates a bulk SQL insert query for associating a list of IDs with a content_id
 * in a many-to-many join table.
 *
 * This function dynamically generates a parameterized SQL query to insert rows
 * into a join table. The `content_id` placeholder patched in a later 
 * transaction step.
 *
 * @param {string} table - The name of the join table (e.g., "experiences_cuisines").
 * @param {string} column - The name of the column representing the associated ID (e.g., "cuisine_id").
 * @param {number[]} ids - An array of numeric IDs to associate with the content.
 * @returns {QueryWithParams} A parameterized SQL insert query object.
 */
function createIdsInsertQuery(
  table: string,
  column: string,
  ids: number[]
): QueryWithParams {
  return {
    sql: `INSERT INTO ${table} (content_id, ${column})
            VALUES ${ids.map((_, i) => `($1, $${i + 2})`).join(', ')}
            ON CONFLICT DO NOTHING`,
    values: [CONTENT_ID_PLACEHOLDER, ...ids],
  };
}

/**
 * Executes a list of queries in a transaction for contents.
 * Inserts content, retrieves its content_id, and patches it into subsequent queries.
 *
 * @param db - Connected Postgres client.
 * @param queries - Ordered list of queries, where the first query returns content_id.
 * @returns Promise that resolves once transaction completes.
 * @throws Propagates any query error after rolling back transaction.
 */
async function executeContentTransaction(
  db: PgClient,
  queries: QueryWithParams[],
): Promise<void> {
  const contentWriteResults = await db.query(queries[0].sql, queries[0].values);

  if (!contentWriteResults.rows.length) {
    throw new Error('Content table insert did not return an ID.');
  }

  const contentId = contentWriteResults.rows[0].content_id;
  for (let i = 1; i < queries.length; i++) {
    const query = queries[i];
    query.values = replacePlaceholders(query.values, {
      [CONTENT_ID_PLACEHOLDER]: contentId,
    });
    await db.query(query.sql, query.values);
  }
}
