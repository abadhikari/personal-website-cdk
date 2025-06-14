import { ContentCategory } from '@lambda/common/types';
import * as Joi from 'joi';

export const baseRequestSchema = Joi.object({
  category: Joi.string()
    .valid(...Object.values(ContentCategory))
    .required()
    .messages({
      'string.base': 'category must be a string',
      'any.required': 'category is required',
      'any.only': `category must be one of: ${Object.values(ContentCategory).join(', ')}`,
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
  venue: Joi.string().required().messages({
    'string.base': 'venue must be a string',
    'any.required': 'venue is required',
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
  price_range: Joi.string()
    .valid('$', '$$', '$$$', '$$$$', '$$$$$')
    .required()
    .messages({
      'string.base': 'price_range must be a string',
      'any.only': 'price_range must be one of: $, $$, $$$, $$$$, $$$$$',
      'any.required': 'price_range is required',
    }),
  cuisines: Joi.array().items(Joi.string()).min(1).optional().messages({
    'array.base': 'cuisines must be an array',
    'array.min': 'at least one cuisine is required if provided',
  }),
});

export function retrieveSchemaForCategory(
  category: string,
): Joi.ObjectSchema | null {
  switch (category) {
    case ContentCategory.FOOD_AND_DRINK:
    case ContentCategory.ENTERTAINMENT:
      return experienceSchema;
    default:
      return null;
  }
}
