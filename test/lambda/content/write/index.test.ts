import { INVALID_ORIGIN, VALID_ORIGIN } from '@test-helpers/constants';
import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => {
  const actual = jest.requireActual('@lambda/common/db');
  return {
    ...actual,
    getDbCredentials: jest.fn(),
    getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
    executeAtomicTransaction: jest.fn((client, queries, fn) =>
      fn(client, queries),
    ),
  };
});

describe('content write handler', () => {
  let handler: any;

  const VALID_FOOD_AND_DRINK_BODY = {
    categoryId: 4,
    payload: {
      title: 'Sushi Place',
      address: '123 Main St',
      city: 'NYC',
      venueId: 1,
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.006,
      priceLevel: 2,
      cuisineIds: [1, 2],
    },
  };

  const VALID_ENTERTAINMENT_BODY = {
    categoryId: 5,
    payload: {
      title: 'Carnegie Hall',
      address: '123 Main St',
      city: 'NYC',
      venueId: 3,
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.006,
      priceLevel: 3,
    },
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = VALID_ORIGIN;

    // first call returns content_id, subsequent calls succeed silently
    queryMock.mockResolvedValue({ rows: [{ content_id: 'mock-id' }] });

    handler = require('@lambda/content/write/index').handler;
  });

  it('returns 200 and executes expected SQL on valid FoodAndDrink payload', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_FOOD_AND_DRINK_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Content written successfully.');

    // first query should be the INSERT INTO content
    expect(queryMock.mock.calls[0][0]).toMatch(/insert into content/i);
    console.log(queryMock.mock.calls);

    // second query should receive the patched content_id as its first param
    const secondQueryParams = queryMock.mock.calls[1][1];
    expect(secondQueryParams[0]).toBe('mock-id');
  });

  it('returns 200 and executes expected SQL on valid Entertainment payload', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_ENTERTAINMENT_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Content written successfully.');

    // first query should be the INSERT INTO content
    expect(queryMock.mock.calls[0][0]).toMatch(/insert into content/i);

    // second query should receive the patched content_id as its first param
    const secondQueryParams = queryMock.mock.calls[1][1];
    expect(secondQueryParams[0]).toBe('mock-id');
  });

  it('returns 403 when origin is not allow‑listed', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: VALID_ENTERTAINMENT_BODY,
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
        body: { foo: 'bar' },
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
        body: VALID_FOOD_AND_DRINK_BODY,
        headers: {
          origin: VALID_ORIGIN,
        },
      }),
    );
    expect(res.statusCode).toBe(500);
  });

  describe('Environment variable validation (content)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    test('throws when DB_SECRET_ARN is missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/content/write/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    test('throws when ORIGIN_ALLOWLIST is missing or empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/content/write/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
