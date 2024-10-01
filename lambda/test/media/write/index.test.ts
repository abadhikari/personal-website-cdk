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

describe('Write Lambda Handler Tests', () => {
  let dynamoDbSendMock: jest.Mock;
  let PutCommandMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';

    dynamoDbSendMock = jest.fn();
    PutCommandMock = jest.fn();

    jest.mock('@aws-sdk/client-dynamodb', () => {
      return {
        DynamoDBClient: jest.fn(),
      };
    });

    jest.mock('@aws-sdk/lib-dynamodb', () => {
      return {
        DynamoDBDocumentClient: {
          from: () => ({
            send: dynamoDbSendMock,
          }),
        },
        PutCommand: PutCommandMock.mockImplementation((params) => ({
          input: params,
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
    dynamoDbSendMock.mockResolvedValue({});

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Media metadata saved successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
  });

  test('Error - Missing Request Body', async () => {
    const event: APIGatewayProxyEvent = {} as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Request body is missing.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Invalid JSON Format', async () => {
    const event: APIGatewayProxyEvent = {
      body: 'Invalid JSON String',
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Invalid JSON format.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
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
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
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
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - DynamoDB putItem Error returns 500', async () => {
    dynamoDbSendMock.mockRejectedValue(new Error('DynamoDB error'));

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Failed to save metadata.');
    expect(dynamoDbSendMock).toHaveBeenCalled();
  });

  test('ConditionalCheckFailedException is Handled Gracefully and returns 200', async () => {
    const conditionalError = new Error('ConditionalCheckFailedException');
    conditionalError.name = 'ConditionalCheckFailedException';
    dynamoDbSendMock
      .mockRejectedValueOnce(conditionalError) // For stack metadata
      .mockResolvedValueOnce({}); // For media metadata

    const event: APIGatewayProxyEvent = {
      body: JSON.stringify(VALID_INPUT),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Media metadata saved successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
  });

  describe('Environment variable validation', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('should throw an error when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('../../../media/write/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('../../../media/write/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });
  });
});
