import { APIGatewayProxyEvent } from 'aws-lambda';

/* helper to fake an API Gateway event */

function createMockPatchEvent(
  queryStringParameters: Record<string, any>,
  body: Record<string, any>,
): Partial<APIGatewayProxyEvent> {
  return {
    queryStringParameters,
    httpMethod: 'PATCH',
    headers: { Origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  };
}

describe('Edit Lambda Handler Tests', () => {
  let dynamoDbSendMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';

    dynamoDbSendMock = jest.fn();

    jest.mock('@aws-sdk/client-dynamodb', () => ({
      DynamoDBClient: jest.fn(),
    }));

    jest.mock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: { from: () => ({ send: dynamoDbSendMock }) },
      UpdateCommand: jest.fn((input) => ({ input })),
    }));

    handler = require('../../../stack/edit/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('happy path – updates caption and location', async () => {
    dynamoDbSendMock.mockResolvedValueOnce({});

    const event = createMockPatchEvent(
      { stackId: 'stack123' },
      { caption: 'Updated Caption', location: 'New York' },
    );

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Data updated successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(1);
  });

  test('validation error – missing stackId', async () => {
    const event = createMockPatchEvent({}, { caption: 'New Caption' });

    const res = await handler(event as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid request/i);
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('validation error – neither caption nor location provided', async () => {
    const event = createMockPatchEvent({ stackId: 'stack123' }, {});

    const res = await handler(event as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(
      /at least one of caption or location must be provided/i,
    );
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin is not allow‑listed', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { stackId: 'stack123' },
      httpMethod: 'PATCH',
      headers: { Origin: 'http://malicious.com' },
      body: JSON.stringify({ caption: 'Unsafe' }),
    };

    const res = await handler(event as any);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Forbidden: Invalid origin');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  describe('Environment variable validation (delete Lambda)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('throws when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('../../../stack/edit/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('throws when ORIGIN_ALLOWLIST is missing or empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('../../../stack/edit/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
