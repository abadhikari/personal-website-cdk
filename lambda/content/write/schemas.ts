import * as Joi from 'joi';

import { ContentCategory } from '@lambda/common/types';

export const baseRequestSchema = Joi.object({
  categoryId: Joi.number()
    .integer()
    .valid(...Object.values(ContentCategory))
    .required()
    .messages({
      'number.base': 'categoryId must be a number',
      'any.required': 'categoryId is required',
      'any.only': `categoryId must be one of: ${Object.values(ContentCategory).join(', ')}`,
    }),
  payload: Joi.object().required().messages({
    'object.base': 'payload must be an object',
    'any.required': 'payload is required',
  }),
});

export const experienceSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    'string.base': 'title must be a string',
    'any.required': 'title is required',
  }),
  address: Joi.string().trim().required().messages({
    'string.base': 'address must be a string',
    'any.required': 'address is required',
  }),
  city: Joi.string().trim().required().messages({
    'string.base': 'city must be a string',
    'any.required': 'city is required',
  }),
  state: Joi.string().trim().optional().messages({
    'string.base': 'state must be a string',
  }),
  venueId: Joi.number().integer().positive().required().messages({
    'number.base': 'venueId must be a number',
    'number.integer': 'venueId must be an integer',
    'number.positive': 'venueId must be a positive number',
    'any.required': 'venueId is required',
  }),
  country: Joi.string().trim().required().messages({
    'string.base': 'country must be a string',
    'any.required': 'country is required',
  }),
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.base': 'latitude must be a number',
    'number.min': 'latitude must be at least -90',
    'number.max': 'latitude must be at most 90',
    'any.required': 'latitude is required',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.base': 'longitude must be a number',
    'number.min': 'longitude must be at least -180',
    'number.max': 'longitude must be at most 180',
    'any.required': 'longitude is required',
  }),
  priceLevel: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'priceLevel must be a number',
    'number.integer': 'priceLevel must be an integer',
    'number.min': 'priceLevel must be between 1 and 5',
    'number.max': 'priceLevel must be between 1 and 5',
    'any.required': 'priceLevel is required',
  }),
  cuisineIds: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .optional()
    .messages({
      'array.base': 'cuisineIds must be an array',
      'array.min': 'at least one cuisineId is required if provided',
      'number.base': 'each cuisineId must be a number',
      'number.integer': 'each cuisineId must be an integer',
      'number.positive': 'each cuisineId must be a positive number',
    }),
  dishIds: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .optional()
    .messages({
      'array.base': 'dishIds must be an array',
      'array.min': 'at least one dishId is required if provided',
      'number.base': 'each dishId must be a number',
      'number.integer': 'each dishId must be an integer',
      'number.positive': 'each dishId must be a positive number',
    }),
  genreIds: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .optional()
    .messages({
      'array.base': 'genreIds must be an array',
      'array.min': 'at least one genreId is required if provided',
      'number.base': 'each genreId must be a number',
      'number.integer': 'each genreId must be an integer',
      'number.positive': 'each genreId must be a positive number',
    }),
});

export const bookSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    'string.base': 'title must be a string',
    'any.required': 'title is required',
  }),
  author: Joi.string().trim().required().messages({
    'string.base': 'author must be a string',
    'any.required': 'author is required',
  }),
  pages: Joi.number().integer().positive().required().messages({
    'number.base': 'pages must be a number',
    'number.integer': 'pages must be an integer',
    'number.positive': 'pages must be greater than 0',
    'any.required': 'pages is required',
  }),
  yearPublished: Joi.number().integer().min(1400).required().messages({
    'number.base': 'yearPublished must be a number',
    'number.integer': 'yearPublished must be an integer',
    'number.min': 'yearPublished must be after 1400',
    'any.required': 'yearPublished is required',
  }),
  isbn: Joi.string().trim().optional().messages({
    'string.base': 'isbn must be a string',
  }),
  genreIds: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required()
    .messages({
      'array.base': 'genreIds must be an array',
      'array.min': 'at least one genreId must be selected',
      'number.base': 'each genreId must be a number',
      'number.integer': 'each genreId must be an integer',
      'number.positive': 'each genreId must be a positive number',
      'any.required': 'genreIds is required',
    }),
});

export function retrieveSchemaForCategory(
  category: number,
): Joi.ObjectSchema | null {
  switch (category) {
    case ContentCategory.BOOK:
      return bookSchema;
    case ContentCategory.FOOD_AND_DRINK:
    case ContentCategory.ENTERTAINMENT:
      return experienceSchema;
    default:
      return null;
  }
}
