import * as Joi from 'joi';

export const queryParametersSchema = Joi.object({
  stackId: Joi.string().required().messages({
    'string.base': 'stackId must be a string',
    'any.required': 'stackId is required',
  }),
  mediaId: Joi.string().optional().messages({
    'string.base': 'mediaId must be a string',
  }),
});
