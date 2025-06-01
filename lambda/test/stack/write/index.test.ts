import { APIGatewayProxyEvent } from 'aws-lambda';

function createMockEvent(
  body: any,
  authToken?: string,
): Partial<APIGatewayProxyEvent> {
  return {
    body: body,
    httpMethod: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Authorization: authToken,
    },
  };
}

const VALID_INPUT = {
  stackId: 'stack123',
  caption: 'A sample caption',
  uploadTimestamp: Date.now(),
  location: 'Sample location',
  media: [
    {
      mediaId: 'media123',
      alternativeText: 'An image',
      imagePath: {
        full: 'full.jpg',
        thumbnail: 'thumbnail.jpg',
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
    process.env.CDN_DOMAIN_URL = 'random.cloudfront.net';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';
    process.env.STACK_METADATA_GSI_PARTITION_KEY = 'ALL_STACKS';
    process.env.ADMIN_COGNITO_POOL_DOMAIN =
      'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abcdefghi';

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

    jest.mock('../../../common/auth', () => ({
      authenticateToken: jest.fn().mockResolvedValue(undefined),
    }));

    // Import the handler after mocking
    handler = require('../../../stack/write/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Happy Path - Valid Input returns 200', async () => {
    dynamoDbSendMock.mockResolvedValue({});

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(VALID_INPUT),
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Media metadata saved successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
  });

  test('Error - Missing Request Body', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      undefined,
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Request body is missing.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Invalid JSON Format', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      'Invalid JSON String',
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Invalid JSON format.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Invalid Fields) returns 400', async () => {
    const invalidInput = {
      invalidField: 'This field is not expected',
    };

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(invalidInput),
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid request:');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Missing Required Fields) returns 400', async () => {
    const invalidInput = {
      stackId: 'stack123',
    };

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(invalidInput),
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid request:');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - DynamoDB putItem Error returns 500', async () => {
    dynamoDbSendMock.mockRejectedValue(new Error('DynamoDB error'));

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(VALID_INPUT),
      'Bearer mocked-token',
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Failed to save metadata.');
    expect(dynamoDbSendMock).toHaveBeenCalled();
  });

  test('Error - Unauthorized Error (Missing token) returns 401', async () => {
    dynamoDbSendMock.mockResolvedValue({});

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(VALID_INPUT),
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).message).toBe(
      'Unauthorized: Missing token',
    );
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('ConditionalCheckFailedException is Handled Gracefully and returns 200', async () => {
    const conditionalError = new Error('ConditionalCheckFailedException');
    conditionalError.name = 'ConditionalCheckFailedException';
    dynamoDbSendMock
      .mockRejectedValueOnce(conditionalError) // For stack metadata
      .mockResolvedValueOnce({}); // For media metadata

    const event: Partial<APIGatewayProxyEvent> = createMockEvent(
      JSON.stringify(VALID_INPUT),
      'Bearer mocked-token',
    );

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
        require('../../../stack/write/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('../../../stack/write/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when CDN_DOMAIN_URL is missing', () => {
      delete process.env.CDN_DOMAIN_URL;

      expect(() => {
        require('../../../stack/write/index');
      }).toThrow('CDN_DOMAIN_URL environment variable is missing.');
    });

    test('should throw an error when ORIGIN_ALLOWLIST is is missing', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('../../../stack/write/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });

    test('should throw an error when STACK_METADATA_GSI_PARTITION_KEY is missing', () => {
      delete process.env.STACK_METADATA_GSI_PARTITION_KEY;

      expect(() => {
        require('../../../stack/write/index');
      }).toThrow(
        'STACK_METADATA_GSI_PARTITION_KEY environment variable is missing.',
      );
    });

    test('should throw an error when ADMIN_COGNITO_POOL_DOMAIN is missing', () => {
      delete process.env.ADMIN_COGNITO_POOL_DOMAIN;

      expect(() => {
        require('../../../stack/write/index');
      }).toThrow('ADMIN_COGNITO_POOL_DOMAIN environment variable is missing.');
    });
  });
});
