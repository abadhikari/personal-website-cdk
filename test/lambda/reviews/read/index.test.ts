import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => ({
  getDbCredentials: jest.fn(),
  getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
}));

describe('reviews read handler', () => {
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = 'http://localhost:3000';

    queryMock.mockResolvedValue({ rows: [{ foo: 'bar' }] });

    handler = require('@lambda/reviews/read/index').handler;
  });

  it('200 + expected SQL (search present)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '10', search: 'Sushi' },
        headers: { origin: VALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.results)).toBe(true);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toMatch(/select\s+review_id/i);
    expect(params).toEqual(['%sushi%', 10]);
  });

  it('200 + expected SQL (no search)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '5' },
        headers: { origin: VALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(200);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toMatch(/select\s+review_id/i);
    expect(params).toEqual([5]);
  });

  it('200 + expected SQL (search + cursor)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          limit: '7',
          search: 'Jazz',
          cursor: '2025-01-01T00:00:00Z',
        },
        headers: { origin: VALID_ORIGIN },
      }),
    );

    expect(res.statusCode).toBe(200);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toMatch(/select\s+review_id/i);
    expect(params).toEqual(['%jazz%', '2025-01-01T00:00:00.000Z', 7]);
  });

  it('403 when origin not allow-listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '5' },
        headers: { origin: INVALID_ORIGIN },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('400 when query params missing', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        headers: { origin: VALID_ORIGIN },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid schema (limit out of range)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '0' },
        headers: { origin: VALID_ORIGIN },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('500 when database query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('query err'));

    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '5' },
        headers: { origin: VALID_ORIGIN },
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  describe('Environment variable validation (reviews-read)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('throws when DB_SECRET_ARN missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/reviews/read/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    it('throws when ORIGIN_ALLOWLIST missing / empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/reviews/read/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
