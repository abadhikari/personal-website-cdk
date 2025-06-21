import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const dynamoDbSendMock = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
DynamoDBDocumentClient: { from: () => ({ send: dynamoDbSendMock }) },
UpdateCommand: jest.fn((input) => ({ input })),
}));

describe('Edit Lambda Handler Tests', () => {
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';

    handler = require('@lambda/stack/edit/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('happy path – updates caption and location', async () => {
    dynamoDbSendMock.mockResolvedValueOnce({});

    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: {
        caption: 'Updated Caption',
        location: 'New York',
      },
    }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe(
      'Data updated successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(1);
  });

  test('validation error – missing stackId', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: {},
      body: { caption: 'New Caption' },
    }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid request/i);
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('validation error – neither caption nor location provided', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: {},
    }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(
      /at least one of caption or location must be provided/i,
    );
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin is not allow‑listed', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: INVALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: { caption: 'Unsafe' },
    }));

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Forbidden: Invalid origin');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('handler returns 400 when request body is missing', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: undefined,
    }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Request body is missing.');
  });

  test('handler returns 400 when body is invalid JSON', async () => {
    const res = await handler({
      ...createMockEvent({
        httpMethod: 'PATCH',
        headers: { origin: VALID_ORIGIN },
        queryStringParameters: { stackId: 'stack123' },
      }),
      body: '{"caption": "incomplete"',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Invalid JSON format.');
  });

  test('handler returns 400 when validation fails (missing caption/location)', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: {},
    }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/Invalid request:/);
  });

  test('returns 500 when DynamoDB update fails', async () => {
    dynamoDbSendMock.mockRejectedValue(new Error('Simulated DB failure'));

    const event = createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { stackId: 'stack123' },
      body: { caption: 'Boom' },
    });

    const res = await handler(event);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe('Internal server error.');
  });

  describe('Environment variable validation (delete Lambda)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('throws when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('@lambda/stack/edit/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('throws when ORIGIN_ALLOWLIST is missing or empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('@lambda/stack/edit/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
