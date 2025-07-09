import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { getConfig } from '@lambda/common/config/publicDatabase';
import { handleInvalidOrigin, retrieveOrigin } from '@lambda/common/cors';
import { createResponse } from '@lambda/common/createResponse';
import { getDbClient, getDbCredentials } from '@lambda/common/db';
import { ValidationError } from '@lambda/common/errors';
import { QueryWithParams } from '@lambda/common/types';

import { queryParamSchema } from './schemas';

const { DB_SECRET_ARN, ORIGIN_ALLOWLIST } = getConfig();

/**
 * Interface representing the validated query parameters for the reviews read request.
 *
 * @property limit - Maximum number of results to return (validated upstream via Joi).
 * @property search - Optional case-insensitive substring to filter reviews by title.
 * @property cursor - Optional ISO 8601 timestamp string used for pagination. Filters reviews created before this timestamp.
 */
export interface QueryParameters {
  limit: number;
  search?: string;
  cursor?: string;
}

/**
 * The main Lambda handler function that processes the read API Gateway request and queries the database.
 *
 * @param event - The API Gateway event containing the request.
 * @returns A Promise that resolves to the API Gateway response indicating success or failure.
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
    queryParameters = parseQueryParameters(event);
    const { search, limit, cursor } = queryParameters;

    const credentials = await getDbCredentials(DB_SECRET_ARN);
    const db = await getDbClient(credentials);

    const query = createReviewQuery(limit, search, cursor);
    const result = await db.query(query.sql, query.values);

    const rows = result.rows;
    const nextCursor =
      rows.length > 0
        ? new Date(rows[rows.length - 1].created_at).toISOString()
        : null;

    return createResponse(200, { results: rows, nextCursor }, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      return createResponse(
        error.statusCode,
        { message: error.message },
        origin,
      );
    }

    console.error('Error reading reviews:', error, queryParameters);
    return createResponse(500, { message: 'Failed to read reviews.' }, origin);
  }
};

/**
 * Parses the incoming API Gateway event to extract and validate the query parameters.
 *
 * @param event - The API Gateway event containing the request.
 * @returns The parsed and validated query parameters, or an error response if the input is invalid.
 * @throws {ValidationError} - Throws validation errors if the query params are invalid.
 */
function parseQueryParameters(event: APIGatewayProxyEvent): QueryParameters {
  if (!event.queryStringParameters) {
    throw new ValidationError('Query parameters are missing.');
  }

  const { error, value } = queryParamSchema.validate(
    event.queryStringParameters,
  );
  if (error) {
    throw new ValidationError('Invalid request: ' + error.details[0].message);
  }

  return value;
}

/**
 * Builds a single SQL query that:
 *   1. Pages/searches the reviews table (`base` CTE)
 *   2. Adds one sibling CTE per category (books, movies, experiences, shows…)
 *   3. COALESCEs the category-specific JSON blob into `subcontent`
 *
 * @param limit  The number of reviews to return (max 1000)
 * @param search Optional full-text search query
 * @param cursor Optional ISO timestamp string for pagination (reviews created before this)
 * @returns QueryWithParams object with:
 * - `sql`: the generated SQL string
 * - `values`: [search, cursor, limit] parameter bindings
 */
export function createReviewQuery(
  limit: number,
  search?: string,
  cursor?: string,
): QueryWithParams {
  const sql = `
WITH base AS (
    SELECT
        r.review_id,
        r.content_id,
        r.rating,
        r.review_text,
        r.created_at,
        c.category_id,
        c.title
    FROM reviews r
    JOIN contents c USING (content_id)
    WHERE ($1::text        IS NULL OR LOWER(r.review_text) LIKE '%'||LOWER($1)||'%'
           OR LOWER(c.title) LIKE '%'||LOWER($1)||'%')
      AND ($2::timestamptz IS NULL OR r.created_at < $2)
    ORDER BY r.created_at DESC
    LIMIT $3
),

entertainment_rows AS (
    SELECT
        e.content_id,
        jsonb_build_object(
            'title',       e.title,
            'address',     e.address,
            'city',        e.city,
            'state',       e.state,
            'country',     e.country,
            'latitude',    e.latitude,
            'longitude',   e.longitude,
            'price_level', e.price_level,
            'venue',       v.name,
            'genres',      COALESCE(
                             jsonb_agg(DISTINCT eg.name)
                             FILTER (WHERE eg.name IS NOT NULL), '[]')
        ) AS subcontent
    FROM   base b
    JOIN   experiences e        USING (content_id)
    JOIN   venue       v        ON v.venue_id = e.venue_id
    LEFT   JOIN experiences_genres egj USING (content_id)
    LEFT   JOIN experience_genre eg   ON eg.experience_genre_id = egj.experience_genre_id
    WHERE  b.category_id = 5
    GROUP  BY e.content_id, v.name
),

food_and_drink_rows AS (
    SELECT
        e.content_id,
        jsonb_build_object(
            'title',       e.title,
            'address',     e.address,
            'city',        e.city,
            'state',       e.state,
            'country',     e.country,
            'latitude',    e.latitude,
            'longitude',   e.longitude,
            'price_level', e.price_level,
            'venue',       v.name,
            'cuisines',    COALESCE(
                             jsonb_agg(DISTINCT cu.name)
                             FILTER (WHERE cu.name IS NOT NULL), '[]'),
            'dishes',      COALESCE(
                             jsonb_agg(DISTINCT d.name)
                             FILTER (WHERE d.name IS NOT NULL), '[]')
        ) AS subcontent
    FROM   base b
    JOIN   experiences e        USING (content_id)
    JOIN   venue       v        ON v.venue_id = e.venue_id
    LEFT   JOIN experiences_cuisines ec USING (content_id)
    LEFT   JOIN cuisine cu      ON cu.cuisine_id = ec.cuisine_id
    LEFT   JOIN experiences_dishes ed USING (content_id)
    LEFT   JOIN dish d               ON d.dish_id = ed.dish_id
    WHERE  b.category_id = 4
    GROUP  BY e.content_id, v.name
),

book_rows AS (
    SELECT
        bo.content_id,
        jsonb_build_object(
            'title',          bo.title,
            'author',         bo.author,
            'pages',          bo.pages,
            'year_published', bo.year_published,
            'isbn',           bo.isbn,
            'genres',         COALESCE(
                                jsonb_agg(DISTINCT g.name)
                                FILTER (WHERE g.name IS NOT NULL), '[]')
        ) AS subcontent
    FROM   base b
    JOIN   books bo             USING (content_id)
    LEFT   JOIN media_genres cg USING (content_id)
    LEFT   JOIN media_genre g         USING (media_genre_id)
    WHERE  b.category_id = 3
    GROUP  BY bo.content_id
),

movie_rows AS (
    SELECT
        mo.content_id,
        jsonb_build_object(
            'title',          mo.title,
            'director',       mo.director,
            'duration_min',   mo.duration_min,
            'year_released',  mo.year_released,
            'country',        mo.country,
            'studio',         mo.studio,
            'imdb_rating_x10',mo.imdb_rating_x10,
            'genres',         COALESCE(
                                jsonb_agg(DISTINCT g.name)
                                FILTER (WHERE g.name IS NOT NULL), '[]')
        ) AS subcontent
    FROM   base b
    JOIN   movies mo            USING (content_id)
    LEFT   JOIN media_genres cg USING (content_id)
    LEFT   JOIN media_genre g         USING (media_genre_id)
    WHERE  b.category_id = 1
    GROUP  BY mo.content_id
),

show_rows AS (
    SELECT
        s.content_id,
        jsonb_build_object(
            'title',          s.title,
            'year_released',  s.year_released,
            'country',        s.country,
            'studio',         s.studio,
            'imdb_rating_x10',s.imdb_rating_x10,
            'genres',         COALESCE(
                                jsonb_agg(DISTINCT g.name)
                                FILTER (WHERE g.name IS NOT NULL), '[]')
        ) AS subcontent
    FROM   base b
    JOIN   shows s             USING (content_id)
    LEFT   JOIN media_genres cg USING (content_id)
    LEFT   JOIN media_genre g         USING (media_genre_id)
    WHERE  b.category_id = 2
    GROUP  BY s.content_id
)

SELECT
    b.review_id,
    b.rating,
    b.review_text,
    b.created_at,
    b.category_id,
    COALESCE(mr.subcontent,
             sr.subcontent,
             br.subcontent,
             fdr.subcontent,
             er.subcontent
    ) AS subcontent
FROM base b
LEFT JOIN movie_rows      mr USING (content_id)
LEFT JOIN show_rows       sr USING (content_id)
LEFT JOIN book_rows       br USING (content_id)
LEFT JOIN food_and_drink_rows fdr USING (content_id)
LEFT JOIN entertainment_rows er USING (content_id)
ORDER BY b.created_at DESC;
`;

  return {
    sql,
    values: [search ?? null, cursor ?? null, limit],
  };
}
