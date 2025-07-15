import * as Joi from 'joi';

import { LookupTypes } from '@lambda/common/types';

export const requestSchema = Joi.object({
  lookupType: Joi.string()
    .trim()
    .valid(...Object.values(LookupTypes))
    .required()
    .messages({
      'string.base': 'lookupType must be a string',
      'any.required': 'lookupType is required',
      'any.only': `lookupType must be one of: ${Object.values(LookupTypes).join(', ')}`,
    }),
  newValue: Joi.string().trim().min(1).required().messages({
    'string.base': 'newValue must be a string',
    'string.empty': 'newValue cannot be empty',
    'any.required': 'newValue is required',
  }),
});
