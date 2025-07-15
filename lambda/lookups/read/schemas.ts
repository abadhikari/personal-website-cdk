import * as Joi from 'joi';

import { LookupTypes } from '@lambda/common/types';

export const queryParamSchema = Joi.object({
  lookupType: Joi.string()
    .trim()
    .valid(...Object.values(LookupTypes))
    .required()
    .messages({
      'string.base': 'lookupType must be a string',
      'any.required': 'lookupType is required',
      'any.only': `lookupType must be one of: ${Object.values(LookupTypes).join(', ')}`,
    }),
  query: Joi.string().trim().optional().messages({
    'string.base': 'query must be a string',
  }),
});
