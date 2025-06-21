import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

// Mock the system time to ensure consistent test results
jest.useFakeTimers().setSystemTime(new Date('2023-01-15T00:00:00Z'));

const S3ClientMock = jest.fn();
const PutObjectCommandMock = jest.fn((input) => input);
const getSignedUrlMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: S3ClientMock,
  PutObjectCommand: PutObjectCommandMock,
}));

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: getSignedUrlMock,
  };
});

// Mock uuidv4 to return a fixed UUID
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('GenerateSignedUrls Lambda Function Tests', () => {
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.S3_BUCKET_NAME = 'personal-website-photos-page-media-bucket';
    process.env.S3_URL_TTL = '300';
    process.env.ORIGIN_ALLOWLIST =
      'http://localhost:3000,https://abhinnaadhikari.com';

    handler = require('@lambda/media/generate-signed-urls/index').handler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('should return 200 and signed URLs when given valid input', async () => {
    const requestBody = {
      filesMetadata: [
        {
          fileName: 'testfile.jpg',
          contentType: 'image/jpeg',
          type: 'primary',
        },
      ],
    };

    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: VALID_ORIGIN },
      body: requestBody,
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      },
    });

    // Mock the S3 getSignedUrl method to return a signed URL
    getSignedUrlMock.mockResolvedValue('https://example.com/signed-url');

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.signedUrlsAndKeys).toEqual([
      {
        uploadUrl: 'https://example.com/signed-url',
        key: 'user/user123/2023/01/mock-uuid_testfile.jpg',
        type: 'primary',
      },
    ]);

    // Verify that getSignedUrl was called with correct parameters
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Bucket: 'personal-website-photos-page-media-bucket',
        Key: 'user/user123/2023/01/mock-uuid_testfile.jpg',
        ContentType: 'image/jpeg',
      }),
      { expiresIn: 300 },
    );
  });

  test('should return 403 when origin in request is invalid', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: INVALID_ORIGIN },
      body: {
        filesMetadata: [
          {
            fileName: 'testfile.jpg',
            contentType: 'image/jpeg',
            type: 'thumbnail',
          },
        ],
      },
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Forbidden: Invalid origin');
  });

  test('should return 400 when request body is missing', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: VALID_ORIGIN },
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Request body is missing.');
  });

  test('should return 400 when request body is invalid JSON', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: VALID_ORIGIN },
      body: 'Invalid JSON String',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Invalid JSON format.');
  });

  test('should return 400 when request body fails schema validation with missing file name', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: VALID_ORIGIN },
      body: {
        filesMetadata: [{ contentType: 'image/jpeg' }],
      },
      requestContext: {
        authorizer: { claims: { sub: 'user123' } },
      },
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Invalid request');
  });

  test('should return 500 when an internal error occurs', async () => {
    getSignedUrlMock.mockRejectedValue(new Error('S3 error'));

    const event = createMockEvent({
      httpMethod: 'POST',
      headers: { origin: VALID_ORIGIN },
      body: {
        filesMetadata: [
          {
            fileName: 'testfile.jpg',
            contentType: 'image/jpeg',
            type: 'thumbnail',
          },
        ],
      },
      requestContext: {
        authorizer: { claims: { sub: 'user123' } },
      },
    });


    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Internal server error.');
  });

  describe('Environment variable validation', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('should throw an error when S3_BUCKET_NAME is missing', () => {
      delete process.env.S3_BUCKET_NAME;

      expect(() => {
        require('@lambda/media/generate-signed-urls/index');
      }).toThrow('S3_BUCKET_NAME environment variable is missing.');
    });

    test('should throw an error when S3_URL_TTL is missing', () => {
      delete process.env.S3_URL_TTL;

      expect(() => {
        require('@lambda/media/generate-signed-urls/index');
      }).toThrow(
        'S3_URL_TTL environment variable is missing or not a valid number',
      );
    });

    test('should throw an error when S3_URL_TTL is not a number', () => {
      process.env.S3_URL_TTL = 'invalid_number';

      expect(() => {
        require('@lambda/media/generate-signed-urls/index');
      }).toThrow(
        'S3_URL_TTL environment variable is missing or not a valid number',
      );
    });

    test('should throw an error when ORIGIN_ALLOWLIST is is missing', () => {
      delete process.env.ORIGIN_ALLOWLIST;

      expect(() => {
        require('@lambda/media/generate-signed-urls/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
