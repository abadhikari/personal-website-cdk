import * as Joi from 'joi';

const mediaSchema = Joi.object({
  mediaId: Joi.string().required().messages({
    'string.base': 'mediaId must be a string',
    'any.required': 'mediaId is required',
  }),
  alternativeText: Joi.string().optional(),
  imageSrc: Joi.object({
    thumbnail: Joi.string()
      .uri({ scheme: ['https'] })
      .required()
      .messages({
        'string.uri': 'thumbnail imageSrc must be a valid HTTPS URL',
        'any.required': 'thumbnail imageSrc is required',
      }),
    full: Joi.string()
      .uri({ scheme: ['https'] })
      .required()
      .messages({
        'string.uri': 'full imageSrc must be a valid HTTPS URL',
        'any.required': 'full imageSrc is required',
      }),
  }).required(),
  mediaType: Joi.string().required().messages({
    'string.base': 'mediaType must be a string',
    'any.required': 'mediaType is required',
  }),
});

export const requestBodySchema = Joi.object({
  stackId: Joi.string().required().messages({
    'string.base': 'stackId must be a string',
    'any.required': 'stackId is required',
  }),
  caption: Joi.string().required().messages({
    'string.base': 'caption must be a string',
    'any.required': 'caption is required',
  }),
  uploadTimestamp: Joi.number()
    .min(0)
    .max(Joi.ref('$currentTimestamp'))
    .required()
    .messages({
      'number.base': 'uploadTimestamp must be a number',
      'number.min': 'uploadTimestamp must be a non-negative number',
      'number.max': 'uploadTimestamp must be in the past',
      'any.required': 'uploadTimestamp is required',
    }),
  location: Joi.string().optional(),
  media: Joi.array().items(mediaSchema).min(1).required().messages({
    'array.min': 'media must contain at least one item',
    'any.required': 'media is required',
  }),
});
