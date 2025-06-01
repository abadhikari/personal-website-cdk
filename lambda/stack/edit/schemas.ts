import * as Joi from 'joi';

export const requestBodySchema = Joi.object({
  stackId: Joi.string().trim().required().messages({
    'string.base': 'stackId must be a string',
    'any.required': 'stackId is required',
  }),
  caption: Joi.string().optional().messages({
    'string.base': 'caption must be a string',
  }),
  location: Joi.string().optional().messages({
    'string.base': 'location must be a string',
  }),
})
  .or('caption', 'location')
  .messages({
    'object.missing': 'At least one of caption or location must be provided',
  });
