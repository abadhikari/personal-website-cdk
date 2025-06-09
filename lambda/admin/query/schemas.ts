import * as Joi from 'joi';

export const requestBodySchema = Joi.object({
  query: Joi.string().required().messages({
    'query.base': 'query must be a string',
    'any.required': 'query is required',
  }),
});
