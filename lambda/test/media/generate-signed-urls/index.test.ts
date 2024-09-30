import { APIGatewayProxyEvent } from 'aws-lambda';

describe('GenerateSignedUrls Lambda Function Tests', () => {
  let getSignedUrlPromiseMock: jest.Mock;
  let promiseMock: jest.Mock;
  let handler: any;

  beforeEach(() => {
    jest.resetModules();

    process.env.S3_BUCKET_NAME = 'personal-website-photos-page-media-bucket';
    process.env.S3_URL_TTL = '300';
    process.env.CDN_URL = 'random.cloudfront.net';

    // Mock the system time to ensure consistent test results
    jest.useFakeTimers().setSystemTime(new Date('2023-01-15T00:00:00Z'));

    jest.mock('aws-sdk', () => {
      getSignedUrlPromiseMock = jest.fn();
      promiseMock = jest.fn();

      return {
        S3: jest.fn(() => ({
          getSignedUrlPromise: getSignedUrlPromiseMock.mockReturnThis(),
          promise: promiseMock,
        })),
      };
    });

    // Mock uuidv4 to return a fixed UUID
    jest.mock('uuid', () => ({
      v4: jest.fn().mockReturnValue('mock-uuid'),
    }));

    // Import the handler after mocking
    handler = require('../../../media/generate-signed-urls/index').handler;
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
          userId: 'user123',
        },
      ],
    };

    const event = {
      body: JSON.stringify(requestBody),
    } as APIGatewayProxyEvent;

    // Mock the S3 getSignedUrlPromise method to return a signed URL
    getSignedUrlPromiseMock.mockResolvedValue('https://example.com/signed-url');

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.signedUrlsAndKeys).toEqual([
      {
        uploadUrl: 'https://example.com/signed-url',
        key: 'user/user123/2023/01/mock-uuid_testfile.jpg',
      },
    ]);
    expect(body.cdnDomainUrl).toBe('random.cloudfront.net');

    // Verify that getSignedUrlPromise was called with correct parameters
    expect(getSignedUrlPromiseMock).toHaveBeenCalledTimes(1);
    expect(getSignedUrlPromiseMock).toHaveBeenCalledWith('putObject', {
      Bucket: 'personal-website-photos-page-media-bucket',
      Key: 'user/user123/2023/01/mock-uuid_testfile.jpg',
      Expires: 300,
      ContentType: 'image/jpeg',
    });
  });

  test('should return 400 when request body is missing', async () => {
    const event = {
      body: null,
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Request body is missing.');
  });

  test('should return 400 when request body is invalid JSON', async () => {
    const event = {
      body: 'Invalid JSON String',
    } as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Invalid JSON format.');
  });

  test('should return 400 when request body fails schema validation', async () => {
    const invalidRequestBody = {
      filesMetadata: [
        {
          // Missing 'fileName' field
          contentType: 'image/jpeg',
          userId: 'user123',
        },
      ],
    };

    const event = {
      body: JSON.stringify(invalidRequestBody),
    } as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Invalid request');
  });

  test('should return 500 when an internal error occurs', async () => {
    const requestBody = {
      filesMetadata: [
        {
          fileName: 'testfile.jpg',
          contentType: 'image/jpeg',
          userId: 'user123',
        },
      ],
    };

    const event = {
      body: JSON.stringify(requestBody),
    } as APIGatewayProxyEvent;

    // Mock the S3 getSignedUrlPromise method to throw an error
    getSignedUrlPromiseMock.mockRejectedValue(new Error('S3 error'));

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
        require('../../../media/generate-signed-urls/index');
      }).toThrow('S3_BUCKET_NAME environment variable is missing.');
    });

    test('should throw an error when S3_URL_TTL is missing', () => {
      process.env.S3_BUCKET_NAME = 'StackMetadataTable';
      delete process.env.S3_URL_TTL;

      expect(() => {
        require('../../../media/generate-signed-urls/index');
      }).toThrow('S3_URL_TTL environment variable is not a valid number');
    });

    test('should throw an error when S3_URL_TTL is not a number', () => {
      process.env.S3_BUCKET_NAME = 'StackMetadataTable';
      process.env.S3_URL_TTL = 'invalid_number';

      expect(() => {
        require('../../../media/generate-signed-urls/index');
      }).toThrow('S3_URL_TTL environment variable is not a valid number');
    });

    test('should throw an error when CDN_URL is missing', () => {
      process.env.S3_BUCKET_NAME = 'personal-website-photos-page-media-bucket';
      process.env.S3_URL_TTL = '300';
      delete process.env.CDN_URL;

      expect(() => {
        require('../../../media/generate-signed-urls/index');
      }).toThrow('CDN_DOMAIN_URL environment variable is missing.');
    });
  });
});
