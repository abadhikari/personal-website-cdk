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
  let queryMock: jest.Mock;
  let promiseMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.STACK_METADATA_GSI = 'UploadTimestampIndex';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.MEDIA_METADATA_GSI = 'StackIdIndex';

    jest.mock('aws-sdk/clients/dynamodb', () => {
      queryMock = jest.fn();
      promiseMock = jest.fn();

      return {
        DocumentClient: jest.fn(() => ({
          query: queryMock.mockReturnThis(),
          promise: promiseMock,
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

    queryMock.mockImplementation((params) => {
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.resolve({ Items: stackItems }),
        };
      } else if (params.TableName === 'MediaMetadataTable') {
        const stackId = params.ExpressionAttributeValues[':stackId'];
        return {
          promise: () =>
            Promise.resolve({
              Items: mediaItems.filter((item) => item.stackId === stackId),
            }),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      })
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
    queryMock.mockImplementation((params) => {
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
      })
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/No stacks found/);
  });

  test('should return 500 error if stack item is missing stackId', async () => {
    const stackItems = [{ uploadTimestamp: 1609459200000 }];

    queryMock.mockImplementation((params) => {
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.resolve({ Items: stackItems }),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 1,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      })
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should return 500 error if DynamoDB query fails for stack metadata', async () => {
    queryMock.mockImplementation((params) => {
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.reject(new Error('DynamoDB query failed')),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      })
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should return 500 error if DynamoDB query fails for media metadata', async () => {
    const stackItems = [{ stackId: 'stack1', uploadTimestamp: 1609459200000 }];

    queryMock.mockImplementation((params) => {
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.resolve({ Items: stackItems }),
        };
      } else if (params.TableName === 'MediaMetadataTable') {
        return {
          promise: () => Promise.reject(new Error('DynamoDB query failed')),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 1,
        startTimestamp: 1609459200000,
        endTimestamp: 1609459300000,
      })
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(/Internal server error/);
  });

  test('should use default values when parameters are missing', async () => {
    const stackItems = [{ stackId: 'stack1', uploadTimestamp: 1609459200000 }];
    const mediaItems = [{ mediaId: 'media1', stackId: 'stack1' }];

    queryMock.mockImplementation((params) => {
      if (params.TableName === 'StackMetadataTable') {
        return {
          promise: () => Promise.resolve({ Items: stackItems }),
        };
      } else if (params.TableName === 'MediaMetadataTable') {
        const stackId = params.ExpressionAttributeValues[':stackId'];
        return {
          promise: () =>
            Promise.resolve({
              Items: mediaItems.filter((item) => item.stackId === stackId),
            }),
        };
      }
      return { promise: () => Promise.resolve({ Items: [] }) };
    });

    const event: APIGatewayProxyEvent = createMockEvent(
      JSON.stringify({
        stackLimit: 2,
      })
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
      })
    );

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toMatch(
      /Invalid request: stackLimit must be greater than 0/
    );
  });
});
