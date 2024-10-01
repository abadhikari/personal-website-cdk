import { APIGatewayProxyEvent } from 'aws-lambda';

function createMockEvent(body: any) {
  return {
    body: body,
    httpMethod: 'POST',
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 1,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 1,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
      }),
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.parse(response.body);
    expect(responseBody.stackAndMediaData).toHaveLength(1);
    expect(responseBody.stackAndMediaData[0].stack).toEqual(stackItems[0]);
    expect(responseBody.stackAndMediaData[0].media).toEqual([
      { mediaId: 'media1', stackId: 'stack1' },
    ]);
  });

  test('should return 400 error if request body is missing', async () => {
    const event: APIGatewayProxyEvent = createMockEvent(null);

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Request body is missing/);
  });

  test('should return 400 error if request body has invalid JSON', async () => {
    const event: APIGatewayProxyEvent = createMockEvent('invalid-json');

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Invalid JSON format/);
  });

  test('should return 400 error if request body fails validation', async () => {
    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: -5,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      }),
    );

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
      process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
      delete process.env.STACK_METADATA_GSI;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('STACK_METADATA_GSI environment variable is missing');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
      process.env.STACK_METADATA_GSI = 'STACK_METADATA_GSI';
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_GSI is missing', () => {
      process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
      process.env.STACK_METADATA_GSI = 'STACK_METADATA_GSI';
      process.env.MEDIA_METADATA_TABLE = 'MEDIA_METADATA_TABLE';
      delete process.env.MEDIA_METADATA_GSI;

      expect(() => {
        require('../../../media/read/index');
      }).toThrow('MEDIA_METADATA_GSI environment variable is missing.');
    });
  });
});
