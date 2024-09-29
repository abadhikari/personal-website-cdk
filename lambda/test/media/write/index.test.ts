import { APIGatewayProxyEvent } from 'aws-lambda';

const VALID_INPUT = {
  stackId: 'stack123',
  caption: 'A sample caption',
  uploadTimestamp: Date.now(),
  location: 'Sample location',
  media: [
    {
      mediaId: 'media123',
      alternativeText: 'An image',
      imageSrc: {
        thumbnail: 'https://example.com/thumbnail.jpg',
        full: 'https://example.com/full.jpg',
      },
      mediaType: 'image',
    },
  ],
};

describe('Lambda Handler Tests', () => {
  let putMock: jest.Mock;
  let promiseMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';

    jest.mock('aws-sdk/clients/dynamodb', () => {
      putMock = jest.fn();
      promiseMock = jest.fn();

      return {
        DocumentClient: jest.fn(() => ({
          put: putMock.mockReturnThis(),
          promise: promiseMock,
        })),
      };
    });

    // Import the handler after mocking
    handler = require('../../../media/write/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Happy Path - Valid Input returns 200', async () => {
    promiseMock.mockResolvedValue({});

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Media metadata saved successfully!'
    );
    expect(putMock).toHaveBeenCalledTimes(2);
  });

  test('Error - Missing Request Body', async () => {
    const event: APIGatewayProxyEvent = {} as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Request body is missing.');
    expect(putMock).not.toHaveBeenCalled();
  });

  test('Error - Invalid JSON Format', async () => {
    const event: APIGatewayProxyEvent = {
      body: 'Invalid JSON String',
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Invalid JSON format.');
    expect(putMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Invalid Fields) returns 400', async () => {
    const invalidInput = {
      invalidField: 'This field is not expected',
    };

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(invalidInput),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid request:');
    expect(putMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Missing Required Fields) returns 400', async () => {
    const invalidInput = {
      stackId: 'stack123',
    };

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(invalidInput),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid request:');
    expect(putMock).not.toHaveBeenCalled();
  });

  test('Error - DynamoDB putItem Error returns 500', async () => {
    promiseMock.mockRejectedValue(new Error('DynamoDB error'));

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Failed to save metadata.');
    expect(putMock).toHaveBeenCalled();
  });

  test('ConditionalCheckFailedException is Handled Gracefully and returns 200', async () => {
    const conditionalError = new Error('ConditionalCheckFailedException');
    (conditionalError as any).code = 'ConditionalCheckFailedException';
    promiseMock
      .mockRejectedValueOnce(conditionalError) // For stack metadata
      .mockResolvedValueOnce({}); // For media metadata

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Media metadata saved successfully!'
    );
    expect(putMock).toHaveBeenCalledTimes(2);
  });
});
