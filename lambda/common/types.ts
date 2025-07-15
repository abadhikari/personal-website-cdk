/**
 * Interface representing the structure of image paths in the media of a parsed request body.
 *
 * @interface ImagePath
 * @property {string} thumbnail - The S3 path of the thumbnail-sized image.
 * @property {string} full - The S3 path of the full-sized image.
 */
export interface ImagePath {
  thumbnail: string;
  full: string;
}

/**
 * A constant map representing all valid content categories in the system.
 *
 * This provides enum-like access (e.g. ContentCategory.FOOD_AND_DRINK),
 * while also allowing for runtime-safe iteration via Object.values().
 */
export const ContentCategory = {
  MOVIE: 1,
  SHOW: 2,
  BOOK: 3,
  FOOD_AND_DRINK: 4,
  ENTERTAINMENT: 5,
} as const;

export type ContentCategoryType =
  (typeof ContentCategory)[keyof typeof ContentCategory];

/**
 * A constant map representing all valid lookup types in the system.
 *
 * This provides enum-like access (e.g. LookupTypes.MEDIA_GENRE),
 * while also allowing for runtime-safe iteration via Object.values().
 */
export const LookupTypes = {
  CUISINE: 'cuisine',
  MEDIA_GENRE: 'media_genre',
  DISH: 'dish',
  EXPERIENCE_GENRE: 'experience_genre',
} as const;

export type LookupType = (typeof LookupTypes)[keyof typeof LookupTypes];

/**
 * Represents a parameterized SQL query.
 *
 * Used to safely construct and execute SQL commands with bound parameters.
 * - `sql`: The SQL query string with placeholders (e.g., `$1`, `$2`) for parameter substitution.
 * - `values`: An array of values to be substituted into the query in place of the placeholders.
 *
 * This pattern helps prevent SQL injection and enables cleaner query composition.
 */
export interface QueryWithParams {
  sql: string;
  values: any[];
}
