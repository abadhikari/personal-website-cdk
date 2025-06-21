import { INVALID_ORIGIN, VALID_ORIGIN } from "@test-helpers/constants";
import createMockEvent from "@test-helpers/createMockEvent";

const dynamoDbSendMock = jest.fn();
const s3SendMock = jest.fn();

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

describe('Delete Lambda Handler Tests', () => {
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Env vars the Lambda expects
    process.env.STACK_METADATA_TABLE = 'StackMetadataTable';
    process.env.MEDIA_METADATA_TABLE = 'MediaMetadataTable';
    process.env.MEDIA_METADATA_GSI = 'MediaMetadataGSI';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';

    // Import the Lambda after mocks & env are set
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
      // Transaction write
      .mockResolvedValueOnce({});

    // S3 delete (called twice: full + thumbnail)
    s3SendMock.mockResolvedValue({});

    const res = await handler(createMockEvent({
      httpMethod: 'DELETE', 
      queryStringParameters: {
        stackId: 'stack123',
        mediaId: 'media123',
      },
      headers: {
        origin: VALID_ORIGIN
      }
    }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe(
      'Data deleted successfully!',
    );
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(2);
    expect(s3SendMock).toHaveBeenCalledTimes(2);
  });

  test('validation error – missing stackId', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'DELETE', 
      headers: {
        origin: VALID_ORIGIN
      }
    }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch('Query parameters are missing.');

    // should not hit Dynamo or S3
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('validation error – missing stackId', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'PATCH',
      headers: { origin: VALID_ORIGIN },
      queryStringParameters: { invalid: 'schema' },
    }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid request/i);
    expect(dynamoDbSendMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('returns 500 when no media items exist', async () => {
    // First send() = QueryCommand → empty Items
    dynamoDbSendMock.mockResolvedValueOnce({ Items: [] });

    const res = await handler(createMockEvent({
      httpMethod: 'DELETE', 
      queryStringParameters: {
        stackId: 'stack123',
      },
      headers: {
        origin: VALID_ORIGIN
      }
    }));

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe('Internal server error.');

    // Only the query runs
    expect(dynamoDbSendMock).toHaveBeenCalledTimes(1);
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin is not allow‑listed', async () => {
    const res = await handler(createMockEvent({
      httpMethod: 'DELETE', 
      queryStringParameters: {
        stackId: 'stack123',
      },
      headers: {
        origin: INVALID_ORIGIN
      }
    }));

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Forbidden: Invalid origin');

    expect(dynamoDbSendMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  test('happy path – deletes last media AND its stack', async () => {
    // Only one media item in this stack ⇒ stack row should be deleted too.
    dynamoDbSendMock
      .mockResolvedValueOnce({
        Items: [
          {
            mediaId: 'mediaSolo',
            imageUrl: {
              full: 'https://cdn/foo/full.jpg',
              thumbnail: 'https://cdn/foo/thumb.jpg',
            },
          },
        ],
      })
      .mockResolvedValueOnce({}); // transact write

    s3SendMock.mockResolvedValue({});

    const res = await handler(
      createMockEvent({
        httpMethod: 'DELETE',
        headers: { origin: VALID_ORIGIN },
        queryStringParameters: { stackId: 'soloStack' }, // no mediaId – delete all
      }),
    );

    expect(res.statusCode).toBe(200);

    // Second call to Dynamo → TransactWriteCommand; confirm both deletes present
    const transactCmd = dynamoDbSendMock.mock.calls[1][0];
    expect(transactCmd.input.TransactItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Delete: { TableName: 'StackMetadataTable', Key: { stackId: 'soloStack' } },
        }),
      ]),
    );
    expect(transactCmd.input.TransactItems).toHaveLength(2); // media + stack
  });

  test('returns 500 if requested mediaId is NOT in the stack', async () => {
    // Stack has different media; lookup will later fail inside deleteMediaItemsFromS3
    dynamoDbSendMock.mockResolvedValueOnce({
      Items: [
        {
          mediaId: 'someOtherId',
          imageUrl: {
            full: 'https://cdn/foo/full.jpg',
            thumbnail: 'https://cdn/foo/thumb.jpg',
          },
        },
      ],
    });

    const res = await handler(
      createMockEvent({
        httpMethod: 'DELETE',
        headers: { origin: VALID_ORIGIN },
        queryStringParameters: { stackId: 'stack123', mediaId: 'missing' },
      }),
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toMatch(/Internal server error/);
  });

  test('logs an error and succeeds when CDN URL is invalid (S3 deletion throws)', async () => {
    dynamoDbSendMock
      .mockResolvedValueOnce({
        Items: [
          {
            mediaId: 'badUrl',
            imageUrl: { full: 'not-a-url', thumbnail: 'still-not-a-url' },
          },
        ],
      })
      .mockResolvedValueOnce({}); // transact write

    // Force any S3 call to throw
    s3SendMock.mockRejectedValue(new Error('S3 rejection'));

    const res = await handler(
      createMockEvent({
        httpMethod: 'DELETE',
        headers: { origin: VALID_ORIGIN },
        queryStringParameters: { stackId: 'stackBad' },
      }),
    );

    expect(res.statusCode).toBe(200); // still succeeds
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
