import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => {
  const actual = jest.requireActual('@lambda/common/db');
  return {
    ...actual,
    getDbCredentials: jest.fn(),
    getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
  };
});

describe('lookup write handler', () => {
  let handler: any;

  const VALID_LOOKUP_BODY = {
    lookupType: 'cuisine',
    newValue: 'Peruvian',
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = VALID_ORIGIN;

    queryMock.mockResolvedValue({
      rows: [{ cuisine_id: 7, name: 'Peruvian' }],
    });

    handler = require('@lambda/lookups/write/index').handler;
  });

  it('returns 201 and expected item when lookup is inserted', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_LOOKUP_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Lookup value written successfully.');
    expect(body.item).toEqual({ id: 7, name: 'Peruvian' });

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringMatching(/insert into cuisine/i),
      ['Peruvian'],
    );
  });

  it('returns 200 and null item if lookup already exists', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_LOOKUP_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Lookup value already exists.');
    expect(body.item).toBeNull();
  });

  it('returns 403 when origin is not allow-listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_LOOKUP_BODY,
        headers: {
          origin: INVALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when body is missing', async () => {
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

  it('returns 400 on malformed JSON', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: 'not json',
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on invalid schema', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: { wrong: 'field' },
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when DB query throws error', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB exploded'));

    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_LOOKUP_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  describe('Environment variable validation (lookup)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('throws when DB_SECRET_ARN is missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/lookups/write/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    test('throws when ORIGIN_ALLOWLIST is missing or empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/lookups/write/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
