import * as Joi from 'joi';

export const requestSchema = Joi.object({
  contentId: Joi.string().guid().required().messages({
    'string.guid': 'content_id must be a valid UUID',
    'any.required': 'content_id is required',
  }),
  userId: Joi.string().guid().required().messages({
    'string.guid': 'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
  ratingx2: Joi.number()
    .integer()
    .valid(...[2, 3, 4, 5, 6, 7, 8, 9, 10])
    .required()
    .messages({
      'number.base': 'rating_x2 must be a number',
      'number.integer': 'rating_x2 must be an integer',
      'any.only': 'rating_x2 must be between 2 and 10 (in steps of 1)',
      'any.required': 'rating_x2 is required',
    }),
  reviewText: Joi.string().trim().empty('').required().messages({
    'string.base': 'review_text must be a string',
    'string.empty': 'review_text cannot be empty string',
    'any.required': 'review_text is required',
  }),
});
