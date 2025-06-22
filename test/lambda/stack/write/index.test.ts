import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const dynamoDbSendMock = jest.fn();
const PutCommandMock = jest.fn();

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
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.CDN_DOMAIN_URL = 'random.cloudfront.net';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';
    process.env.STACK_METADATA_GSI_PARTITION_KEY = 'ALL_STACKS';

    handler = require('@lambda/stack/write/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Happy Path - Valid Input returns 200', async () => {
    dynamoDbSendMock.mockResolvedValue({});

    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
        body: VALID_INPUT,
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe(
      'Media metadata saved successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
  });

  test('returns 403 when Origin is not allow‑listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: INVALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Forbidden: Invalid origin');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Missing Request Body', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Request body is missing.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Invalid JSON Format', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: 'Invalid JSON String',
        headers: { origin: VALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Invalid JSON format.');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Invalid Fields) returns 400', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
        body: {
          invalidField: 'This field is not expected',
        },
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Invalid request:');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - Validation Error (Missing Required Fields) returns 400', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
        body: {
          stackId: 'stack123',
        },
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Invalid request:');
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
  });

  test('Error - DynamoDB putItem Error returns 500', async () => {
    dynamoDbSendMock.mockRejectedValue(new Error('DynamoDB error'));

    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
        body: VALID_INPUT,
      }),
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe('Failed to save metadata.');
    expect(dynamoDbSendMock).toHaveBeenCalled();
  });

  test('ConditionalCheckFailedException is Handled Gracefully and returns 200', async () => {
    const conditionalError = new Error('ConditionalCheckFailedException');
    conditionalError.name = 'ConditionalCheckFailedException';
    dynamoDbSendMock
      .mockRejectedValueOnce(conditionalError) // For stack metadata
      .mockResolvedValueOnce({}); // For media metadata

    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: { origin: VALID_ORIGIN },
        body: VALID_INPUT,
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe(
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
        require('@lambda/stack/write/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when MEDIA_METADATA_TABLE is missing', () => {
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('@lambda/stack/write/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('should throw an error when CDN_DOMAIN_URL is missing', () => {
      delete process.env.CDN_DOMAIN_URL;

      expect(() => {
        require('@lambda/stack/write/index');
      }).toThrow('CDN_DOMAIN_URL environment variable is missing.');
    });

    test('should throw an error when ORIGIN_ALLOWLIST is is missing', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('@lambda/stack/write/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });

    test('should throw an error when STACK_METADATA_GSI_PARTITION_KEY is missing', () => {
      delete process.env.STACK_METADATA_GSI_PARTITION_KEY;

      expect(() => {
        require('@lambda/stack/write/index');
      }).toThrow(
        'STACK_METADATA_GSI_PARTITION_KEY environment variable is missing.',
      );
    });
  });
});
