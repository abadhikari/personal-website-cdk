import { APIGatewayProxyEvent } from 'aws-lambda';

function createMockDeleteEvent(
  queryStringParameters: Record<string, any>,
): Partial<APIGatewayProxyEvent> {
  return {
    queryStringParameters,
    httpMethod: 'DELETE',
    headers: { Origin: 'http://localhost:3000' },
  };
}

describe('Delete Lambda Handler Tests', () => {
  let dynamoDbSendMock: jest.Mock;
  let s3SendMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    /* env vars the Lambda expects */
    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.MEDIA_METADATA_GSI = 'MediaMetadataGSI';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';

    dynamoDbSendMock = jest.fn();
    s3SendMock = jest.fn();

    /* minimal mocks for the AWS SDK v3 clients */
    jest.mock('@aws-sdk/client-dynamodb', () => ({
      DynamoDBClient: jest.fn(),
    }));

    jest.mock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: { from: () => ({ send: dynamoDbSendMock }) },
      QueryCommand: jest.fn((input) => ({ input })),
      TransactWriteCommand: jest.fn((input) => ({ input })),
    }));

    jest.mock('@aws-sdk/client-s3', () => ({
      S3Client: jest.fn(() => ({ send: s3SendMock })),
      DeleteObjectCommand: jest.fn((input) => ({ input })),
    }));

    /* import the Lambda after mocks & env are set */
    handler = require('@lambda/media/delete/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('happy path – deletes one item', async () => {
    dynamoDbSendMock
      .mockResolvedValueOnce({
        Items: [
          {
            mediaId: 'media123',
            imageUrl: {
              full: 'https://cdn/foo/full.jpg',
              thumbnail: 'https://cdn/foo/thumb.jpg',
            },
          },
        ],
      })
      /* 2️⃣ transact write */
      .mockResolvedValueOnce({});

    /* S3 delete (called twice: full + thumbnail) */
    s3SendMock.mockResolvedValue({});

    const event = createMockDeleteEvent({
      stackId: 'stack123',
      mediaId: 'media123',
    });

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      'Data deleted successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
    expect(s3SendMock).toHaveBeenCalledTimes(2);
  });

  test('validation error – missing stackId', async () => {
    const event = createMockDeleteEvent({}); // no query params

    const res = await handler(event as any);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid request/i);

    // should not hit Dynamo or S3
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('returns 500 when no media items exist', async () => {
    // first send() = QueryCommand → empty Items
    dynamoDbSendMock.mockResolvedValueOnce({ Items: [] });

    const res = await handler(
      createMockDeleteEvent({ stackId: 'stack123' }) as any,
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe('Internal server error.');

    // only the query runs
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(1);
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin is not allow‑listed', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { stackId: 'stack123' },
      httpMethod: 'DELETE',
      headers: { Origin: 'http://malicious.com' },
    };

    const res = await handler(event as any);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Forbidden: Invalid origin');

    expect(dynamoDbSendMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  describe('Environment variable validation (delete Lambda)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('throws when STACK_METADATA_TABLE is missing', () => {
      delete process.env.STACK_METADATA_TABLE;

      expect(() => {
        require('@lambda/media/delete/index');
      }).toThrow('STACK_METADATA_TABLE environment variable is missing.');
    });

    test('throws when MEDIA_METADATA_TABLE is missing', () => {
      delete process.env.MEDIA_METADATA_TABLE;

      expect(() => {
        require('@lambda/media/delete/index');
      }).toThrow('MEDIA_METADATA_TABLE environment variable is missing.');
    });

    test('throws when MEDIA_METADATA_GSI is missing', () => {
      delete process.env.MEDIA_METADATA_GSI;

      expect(() => {
        require('@lambda/media/delete/index');
      }).toThrow('MEDIA_METADATA_GSI environment variable is missing.');
    });

    test('throws when ORIGIN_ALLOWLIST is missing or empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('@lambda/media/delete/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });

    test('throws when S3_BUCKET_NAME is missing', () => {
      delete process.env.S3_BUCKET_NAME;

      expect(() => {
        require('@lambda/media/delete/index');
      }).toThrow('S3_BUCKET_NAME environment variable is missing.');
    });
  });
});
