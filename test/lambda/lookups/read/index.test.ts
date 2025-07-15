import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => ({
  getDbCredentials: jest.fn(),
  getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
}));

describe('lookup read handler', () => {
  let handler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = VALID_ORIGIN;

    queryMock.mockResolvedValue({ rows: [{ id: 1, name: 'Mexican' }] });

    handler = require('@lambda/lookups/read/index').handler;
  });

  it('200 + expected SQL (valid lookupType)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { lookupType: 'cuisine' },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.results)).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);

    const [sql] = queryMock.mock.calls[0];
    expect(sql).toMatch(/select .* from cuisine/i);
  });

  it('200 + expected SQL (with query filter)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          lookupType: 'cuisine',
          query: 'sush',
        },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.results)).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/select .* from cuisine/i);
    expect(sql).toMatch(/where name ilike/i);
    expect(params).toEqual(['sush%']);
  });

  it('403 when origin is not allow‑listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { type: 'cuisine' },
        headers: {
          origin: INVALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('400 when query params are missing', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid schema (bad lookupType)', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { type: 'not_a_real_type' },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('500 when database query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB error'));

    const res = await handler(
      createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { lookupType: 'dish' },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  describe('Environment variable validation (lookups-read)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('throws when DB_SECRET_ARN is missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/lookups/read/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    it('throws when ORIGIN_ALLOWLIST is missing / empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/lookups/read/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
