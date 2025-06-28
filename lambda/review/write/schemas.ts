import * as Joi from 'joi';

export const requestSchema = Joi.object({
  contentId: Joi.string().guid().required().messages({
    'string.guid': 'content_id must be a valid UUID',
    'any.required': 'content_id is required',
  }),
  rating: Joi.number()
    .integer()
    .valid(...[1, 2, 3, 4, 5])
    .required()
    .messages({
      'number.base': 'rating must be a number',
      'number.integer': 'rating must be an integer',
      'any.only': 'rating must be between 1 and 5',
      'any.required': 'rating is required',
    }),
  reviewText: Joi.string().trim().empty('').required().messages({
    'string.base': 'review_text must be a string',
    'string.empty': 'review_text cannot be empty string',
    'any.required': 'review_text is required',
  }),
});
