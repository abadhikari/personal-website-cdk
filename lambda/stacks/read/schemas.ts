import * as Joi from 'joi';

export const queryParametersSchema = Joi.object({
  stackLimit: Joi.number().greater(0).required().messages({
    'number.base': 'stackLimit must be positive number',
    'number.greater': 'stackLimit must be greater than 0',
    'any.required': 'stackLimit is required',
  }),
  startTimestamp: Joi.number()
    .min(0)
    .default(() => 0)
    .optional()
    .messages({
      'number.min': 'startTimestamp must be a positive number',
    }),
  endTimestamp: Joi.number()
    .greater(Joi.ref('startTimestamp'))
    .default(() => Date.now())
    .optional()
    .messages({
      'number.greater': 'endTimestamp must be greater than startTimestamp',
    }),
  lastEvaluatedKey: Joi.string().base64().optional().messages({
    'string.base': 'lastEvaluatedKey must be a valid base64-encoded string',
  }),
});
