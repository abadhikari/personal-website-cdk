import * as Joi from 'joi';

const fileMetadataSchema = Joi.object({
  fileName: Joi.string().required().messages({
    'string.base': 'fileName must be a string',
    'any.required': 'fileName is required',
  }),
  contentType: Joi.string()
    .regex(/^.*\/.*$/)
    .required()
    .messages({
      'string.base': 'contentType must be a string',
      'any.required': 'contentType is required',
      'string.pattern.base': 'contentType must be a valid MIME type',
    }),
  userId: Joi.string().required().messages({
    'string.base': 'userId must be a string',
    'any.required': 'userId is required',
  }),
});

export const requestBodySchema = Joi.object({
  filesMetadata: Joi.array()
    .items(fileMetadataSchema)
    .min(1)
    .required()
    .messages({
      'array.base': 'filesMetadata must be an array',
      'array.min': 'filesMetadata must contain at least one item',
      'array.items':
        'Each item in filesMetadata must be a valid fileMetadata object',
      'any.required': 'filesMetadata is required',
    }),
});
