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

describe('Read Lambda Function Tests', () => {
  let dynamoDbSendMock: jest.Mock;

  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.STACK_METADATA_GSI = 'UploadTimestampIndex';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.MEDIA_METADATA_GSI = 'StackIdIndex';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';
    process.env.STACK_METADATA_GSI_PARTITION_KEY = 'ALL_STACKS';

    dynamoDbSendMock = jest.fn();
    const QueryCommandMock = jest.fn();

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
        QueryCommand: QueryCommandMock.mockImplementation((params) => ({
          input: params,
        })),
      };
    });

    // Import the handler after mocking
    handler = require('../../../media/read/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return stack and media data successfully', async () => {
    const stackItems = [
      { stackId: 'stack1', uploadTimestamp: 1609459200000 },
      { stackId: 'stack2', uploadTimestamp: 1609459201000 },
    ];
    const mediaItems = [
      { mediaId: 'media1', stackId: 'stack1' },
      { mediaId: 'media2', stackId: 'stack2' },
      { mediaId: 'media3', stackId: 'stack1' },
    ];

    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return Promise.resolve({ Items: stackItems });
      } else if (params.TableName === 'MediaMetadataTable') {
        const stackId = params.ExpressionAttributeValues[':stackId'];
        return Promise.resolve({
          Items: mediaItems.filter((item) => item.stackId === stackId),
        });
      }
      return Promise.resolve({ Items: [] });
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '2',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.parse(response.body);
    expect(responseBody.stackAndMediaData).toHaveLength(2);
    expect(responseBody.stackAndMediaData[0].stack).toEqual(stackItems[0]);
    expect(responseBody.stackAndMediaData[0].media).toEqual([
      { mediaId: 'media1', stackId: 'stack1' },
      { mediaId: 'media3', stackId: 'stack1' },
    ]);
  });

  test('should return 404 error if no stacks are found', async () => {
    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.resolve({ Items: [] }),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '2',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/No stacks found/);
  });

  test('should return 500 error if stack item is missing stackId', async () => {
    const stackItems = [{ uploadTimestamp: 1609459200000 }];

    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return Promise.resolve({ Items: stackItems });
      }
      return Promise.resolve({ Items: [] });
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '1',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should return 500 error if DynamoDB query fails for stack metadata', async () => {
    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return Promise.reject(new Error('DynamoDB query failed'));
      }
      return Promise.resolve({ Items: [] });
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '2',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should return 500 error if DynamoDB query fails for media metadata', async () => {
    const stackItems = [{ stackId: 'stack1', uploadTimestamp: 1609459200000 }];

    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return Promise.resolve({ Items: stackItems });
      } else if (params.TableName === 'MediaMetadataTable') {
        return Promise.reject(new Error('DynamoDB query failed'));
      }
      return Promise.resolve({ Items: [] });
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '1',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should use default values when parameters are missing', async () => {
    const stackItems = [{ stackId: 'stack1', uploadTimestamp: 1609459200000 }];
    const mediaItems = [{ mediaId: 'media1', stackId: 'stack1' }];

    dynamoDbSendMock.mockImplementation((command) => {
      const params = command.input;
      if (params.TableName === 'StackMetadataTable') {
        return Promise.resolve({ Items: stackItems });
      } else if (params.TableName === 'MediaMetadataTable') {
        const stackId = params.ExpressionAttributeValues[':stackId'];
        return Promise.resolve({
          Items: mediaItems.filter((item) => item.stackId === stackId),
        });
      }
      return Promise.resolve({ Items: [] });
    });

    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '2',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.parse(response.body);
    expect(responseBody.stackAndMediaData).toHaveLength(1);
    expect(responseBody.stackAndMediaData[0].stack).toEqual(stackItems[0]);
    expect(responseBody.stackAndMediaData[0].media).toEqual([
      { mediaId: 'media1', stackId: 'stack1' },
    ]);
  });

  test('should return 400 error if query parameters are missing', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent(null);

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch('Query parameters are missing');
  });

  test('should return 400 error if request body fails validation', async () => {
    const event: Partial<APIGatewayProxyEvent> = createMockEvent({
      stackLimit: '-5',
      startTimestamp: '1609459200000',
      endTimestamp: '1609459300000',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(
      /Invalid request: stackLimit must be greater than 0/,
    );
  });

  describe('Environment variable validation', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('should throw an error when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when STACK_METADATA_GSI is missing', () => {
      delete process.env.STACK_METADATA_GSI;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('STACK_METADATA_GSI environment variable is missing');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_GSI is missing', () => {
      delete process.env.MEDIA_METADATA_GSI;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('MEDIA_METADATA_GSI environment variable is missing.');
    });

    test('should throw an error when ORIGIN_ALLOWLIST is missing', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });

    test('should throw an error when STACK_METADATA_GSI_PARTITION_KEY is missing', () => {
      delete process.env.STACK_METADATA_GSI_PARTITION_KEY;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow(
        'STACK_METADATA_GSI_PARTITION_KEY environment variable is missing.',
      );
    });
  });
});
