import { APIGatewayProxyEvent } from 'aws-lambda';

function createMockEvent(
  queryStringParameters: any,
): Partial<APIGatewayProxyEvent> {
  return {
    queryStringParameters,
    httpMethod: 'GET',
    headers: { Origin: 'http://localhost:3000' },
  };
}

describe('Read Single Stack Lambda Function Tests', () => {
  let dynamoDbSendMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.MEDIA_METADATA_GSI = 'StackIdIndex';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';

    dynamoDbSendMock = jest.fn();

    jest.mock('@aws-sdk/client-dynamodb', () => ({
      DynamoDBClient: jest.fn(),
    }));

    jest.mock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: {
        from: () => ({
          send: dynamoDbSendMock,
        }),
      },
      GetCommand: jest.fn((params) => ({ input: params })),
      QueryCommand: jest.fn((params) => ({ input: params })),
    }));

    handler = require('@lambda/stack/read/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return stack and media data successfully', async () => {
    const stackItem = {
      stackId: 'stack1',
      caption: 'Test',
      uploadTimestamp: 1609459200000,
    };
    const mediaItems = [
      { mediaId: 'media1', stackId: 'stack1' },
      { mediaId: 'media2', stackId: 'stack1' },
    ];

    dynamoDbSendMock.mockImplementation((command) => {
      const { TableName, Key } = command.input;
      if (TableName === 'StackMetadataTable') {
        return Promise.resolve({ Item: stackItem });
      }
      if (TableName === 'MediaMetadataTable') {
        return Promise.resolve({ Items: mediaItems });
      }
      return Promise.resolve({});
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackId: 'stack1',
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.stackAndMediaData.stack).toEqual(stackItem);
    expect(responseBody.stackAndMediaData.media).toEqual(mediaItems);
  });

  test('should return 404 if stack is not found', async () => {
    dynamoDbSendMock.mockResolvedValue({ Item: undefined });
    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackId: 'nonexistent',
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toMatch(/Stack not found/);
  });

  test('should return 500 if DynamoDB throws error', async () => {
    dynamoDbSendMock.mockRejectedValue(new Error('DynamoDB failure'));
    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackId: 'stack1',
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toMatch(/Internal server error/);
  });

  test('should return 400 if query parameters are missing', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent(null);
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(
      /Query parameters are missing/,
    );
  });

  test('should return 400 if stackId is not valid', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackId: '',
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(
      'Invalid request: "stackId" is not allowed to be empty',
    );
  });

  describe('Environment variable validation', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('should throw an error when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('@lambda/stack/read/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('@lambda/stack/read/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_GSI is missing', () => {
      delete process.env.MEDIA_METADATA_GSI;

      expect(() => {
        require('@lambda/stack/read/index');
      }).toThrow('MEDIA_METADATA_GSI environment variable is missing.');
    });

    test('should throw an error when ORIGIN_ALLOWLIST is missing', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('@lambda/stack/read/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
