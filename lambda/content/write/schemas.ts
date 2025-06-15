import { ContentCategory } from '@lambda/common/types';
import * as Joi from 'joi';

export const baseRequestSchema = Joi.object({
  category_id: Joi.number()
    .integer()
    .valid(...Object.values(ContentCategory))
    .required()
    .messages({
      'number.base': 'category_id must be a number',
      'any.required': 'category_id is required',
      'any.only': `category_id must be one of: ${Object.values(ContentCategory).join(', ')}`,
    }),
  payload: Joi.object().required().messages({
    'object.base': 'payload must be an object',
    'any.required': 'payload is required',
  }),
});

export const experienceSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.base': 'name must be a string',
    'any.required': 'name is required',
  }),
  address: Joi.string().required().messages({
    'string.base': 'address must be a string',
    'any.required': 'address is required',
  }),
  city: Joi.string().required().messages({
    'string.base': 'city must be a string',
    'any.required': 'city is required',
  }),
  state: Joi.string().optional().messages({
    'string.base': 'state must be a string',
  }),
  venue_id: Joi.number().integer().positive().required().messages({
    'number.base': 'venue_id must be a number',
    'number.integer': 'venue_id must be an integer',
    'number.positive': 'venue_id must be a positive number',
    'any.required': 'venue_id is required',
  }),
  country: Joi.string().required().messages({
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
  price_level: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'price_level must be a number',
    'number.integer': 'price_level must be an integer',
    'number.min': 'price_level must be between 1 and 5',
    'number.max': 'price_level must be between 1 and 5',
    'any.required': 'price_level is required',
  }),
  cuisine_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .optional()
    .messages({
      'array.base': 'cuisine_ids must be an array',
      'array.min': 'at least one cuisine_id is required if provided',
      'number.base': 'each cuisine_id must be a number',
      'number.integer': 'each cuisine_id must be an integer',
      'number.positive': 'each cuisine_id must be a positive number',
    }),
});

export function retrieveSchemaForCategory(
  category: number,
): Joi.ObjectSchema | null {
  switch (category) {
    case ContentCategory.FOOD_AND_DRINK:
    case ContentCategory.ENTERTAINMENT:
      return experienceSchema;
    default:
      return null;
  }
}
