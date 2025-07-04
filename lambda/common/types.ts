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

export interface QueryWithParams {
  sql: string;
  values: any[];
}
