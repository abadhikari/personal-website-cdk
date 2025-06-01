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
