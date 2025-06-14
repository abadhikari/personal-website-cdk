import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';

const connectMock = jest.fn();
const queryMock = jest.fn();

jest.mock('pg', () => ({
  Client: jest.fn(() => ({ connect: connectMock, query: queryMock })),
}));

function createMockEvent(
  body: any,
  origin = 'http://localhost:3000',
): Partial<APIGatewayProxyEvent> {
  return {
    body,
    httpMethod: 'POST',
    headers: {
      origin: origin,
    },
  };
}

describe('content write handler', () => {
  let handler: any;
  let secretsMock: ReturnType<typeof mockClient>;

  const VALID_SECRET = {
    username: 'user',
    password: 'pass',
    host: 'localhost',
    port: 5432,
    dbname: 'mydb',
  };

  const VALID_FOOD_AND_DRINK_BODY = {
    category: 'FoodAndDrink',
    payload: {
      name: 'Sushi Place',
      address: '123 Main St',
      city: 'NYC',
      venue: 'Sushi Inc.',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.006,
      price_range: '$$',
      cuisines: ['Japanese', 'Seafood'],
    },
  };

  const VALID_ENTERTAINMENT_BODY = {
    category: 'Entertainment',
    payload: {
      name: 'Carnegie Hall',
      address: '123 Main St',
      city: 'NYC',
      venue: 'Live Music',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.006,
      price_range: '$$',
    },
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.DB_SECRET_ARN = 'mock-secret-arn';
    process.env.ORIGIN_ALLOWLIST = 'http://localhost:3000';

    const {
      SecretsManagerClient,
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');

    secretsMock = mockClient(SecretsManagerClient);
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify(VALID_SECRET),
    } as any);

    connectMock.mockResolvedValue(undefined);
    // first call returns content_id, subsequent calls succeed silently
    queryMock.mockResolvedValue({ rows: [{ content_id: 'mock-id' }] });

    handler = require('@lambda/content/write/index').handler;
  });

  it('returns 200 and executes expected SQL on valid FoodAndDrink payload', async () => {
    const res = await handler(
      createMockEvent(JSON.stringify(VALID_FOOD_AND_DRINK_BODY)),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Content written successfully.');

    // first query should be the INSERT INTO content
    expect(queryMock.mock.calls[1][0]).toMatch(/insert into content/i);

    // second query should receive the patched content_id as its first param
    const secondQueryParams = queryMock.mock.calls[2][1];
    expect(secondQueryParams[0]).toBe('mock-id');
  });

  it('returns 200 and executes expected SQL on valid Entertainment payload', async () => {
    const res = await handler(
      createMockEvent(JSON.stringify(VALID_ENTERTAINMENT_BODY)),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Content written successfully.');

    // first query should be the INSERT INTO content
    expect(queryMock.mock.calls[1][0]).toMatch(/insert into content/i);

    // second query should receive the patched content_id as its first param
    const secondQueryParams = queryMock.mock.calls[2][1];
    expect(secondQueryParams[0]).toBe('mock-id');
  });

  it('returns 403 when origin is not allow‑listed', async () => {
    const res = await handler(
      createMockEvent(
        JSON.stringify(VALID_FOOD_AND_DRINK_BODY),
        'https://evil.com',
      ),
    );
    expect(res.statusCode).toBe(403);
  });

  it('400 when body is missing', async () => {
    const res = await handler(createMockEvent(undefined));
    expect(res.statusCode).toBe(400);
  });

  it('400 on malformed JSON', async () => {
    const res = await handler(createMockEvent('{bad json}'));
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid schema', async () => {
    const res = await handler(createMockEvent(JSON.stringify({ foo: 'bar' })));
    expect(res.statusCode).toBe(400);
  });

  it('500 when Secrets Manager fails', async () => {
    const {
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).rejects(new Error('secrets error'));

    const res = await handler(
      createMockEvent(JSON.stringify(VALID_FOOD_AND_DRINK_BODY)),
    );
    expect(res.statusCode).toBe(500);
  });

  it('500 when PG query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('query error'));
    const res = await handler(
      createMockEvent(JSON.stringify(VALID_FOOD_AND_DRINK_BODY)),
    );
    expect(res.statusCode).toBe(500);
  });

  it('rolls back and returns 500 if one of the SQL queries fails mid-transaction', async () => {
    queryMock.mockResolvedValueOnce({});
    queryMock.mockResolvedValueOnce({ rows: [{ content_id: 'mock-id' }] });
    queryMock.mockRejectedValueOnce(new Error('mid-query failure'));

    const res = await handler(
      createMockEvent(JSON.stringify(VALID_FOOD_AND_DRINK_BODY)),
    );

    expect(res.statusCode).toBe(500);
    expect(queryMock).toHaveBeenCalledWith('ROLLBACK');
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
