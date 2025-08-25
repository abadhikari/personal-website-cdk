import * as Joi from 'joi';

import { parseCsvNumbers } from '@lambda/common/joi';
import { ContentCategory } from '@lambda/common/types';

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
      'number.max': 'limit must be at most 1000',
    }),
  cursor: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'cursor must be a valid ISO timestamp',
  }),
  categoryIds: Joi.string()
    .optional()
    .custom((raw, helpers) => {
      if (!raw) return undefined;
      const nums = parseCsvNumbers(raw);

      const arrSchema = Joi.array()
        .items(
          Joi.number()
            .integer()
            .valid(...Object.values(ContentCategory)),
        )
        .min(1)
        .unique();

      const { error, value } = arrSchema.validate(nums, { abortEarly: false });
      if (error)
        return helpers.error('any.invalid', { message: error.message });
      return value;
    }),
});
