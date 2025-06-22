import * as Joi from 'joi';

export const queryParamSchema = Joi.object({
  search: Joi.string().optional().messages({
    'string.base': 'search must be a string',
  }),
  limit: Joi.number()
    .integer()
    .default(20)
    .min(1)
    .max(1000)
    .optional()
    .messages({
      'number.base': 'limit must be a number',
      'number.integer': 'limit must be an integer',
      'number.min': 'limit must be at least 1',
      'number.max': 'limit must be at most 100',
    }),
  cursor: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'cursor must be a valid ISO timestamp',
  }),
});
