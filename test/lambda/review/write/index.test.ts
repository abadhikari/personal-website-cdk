import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => ({
  getDbCredentials: jest.fn(),
  getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
}));

describe('review write handler', () => {
  let handler: any;

  const VALID_BODY = {
    contentId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    ratingx2: 8,
    reviewText: 'Great spot, would return!',
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = 'http://localhost:3000';

    queryMock.mockResolvedValue({});

    handler = require('@lambda/review/write/index').handler;
  });

  it('returns 200 and runs correct INSERT on valid body', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Review written successfully.');

    expect(queryMock.mock.calls[0][0]).toMatch(/insert into reviews/i);

    const [, params] = queryMock.mock.calls[0];
    expect(params).toEqual([
      VALID_BODY.contentId,
      VALID_BODY.userId,
      VALID_BODY.ratingx2,
      VALID_BODY.reviewText,
    ]);
  });

  it('returns 403 when origin not allow-listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_BODY,
        headers: {
          origin: INVALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('400 when body is missing', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 on malformed JSON', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: 'bad json',
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid schema', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: { ...VALID_BODY, ratingx2: 42 },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('500 when database query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('query error'));
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  describe('Environment variable validation (review write)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('throws when DB_SECRET_ARN missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/review/write/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    it('throws when ORIGIN_ALLOWLIST missing / empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/review/write/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
