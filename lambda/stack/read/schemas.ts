import * as Joi from 'joi';

export const queryParametersSchema = Joi.object({
  stackId: Joi.string().trim().required().messages({
    'string.base': 'stackId must be a valid string',
    'any.required': 'stackId is required',
  }),
});
