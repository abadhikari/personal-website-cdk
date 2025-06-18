import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';

const connectMock = jest.fn();
const queryMock = jest.fn();

jest.mock('pg', () => ({
  Client: jest.fn(() => ({ connect: connectMock, query: queryMock })),
}));

function createMockEvent(
  queryStringParameters: Record<string, string | undefined> | undefined,
  origin = 'http://localhost:3000',
): Partial<APIGatewayProxyEvent> {
  return {
    httpMethod: 'GET',
    headers: { origin },
    queryStringParameters,
  };
}

describe('content read handler', () => {
  let handler: any;
  let secretsMock: ReturnType<typeof mockClient>;

  const VALID_SECRET = {
    username: 'user',
    password: 'pass',
    host: 'localhost',
    port: 5432,
    dbname: 'mydb',
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
    queryMock.mockResolvedValue({ rows: [{ foo: 'bar' }] });

    handler = require('@lambda/contents/read/index').handler;
  });

  it('200 + expected SQL (search present)', async () => {
    const res = await handler(
      createMockEvent({ limit: '10', search: 'Sushi' }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.results)).toBe(true);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/select content_id/i);
    expect(params).toEqual(['%sushi%', 10]);
  });

  it('200 + expected SQL (no search)', async () => {
    const res = await handler(createMockEvent({ limit: '5' }));

    expect(res.statusCode).toBe(200);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/select content_id/i);
    expect(params).toEqual([5]);
  });

  it('403 when origin not allow-listed', async () => {
    const res = await handler(
      createMockEvent({ limit: '5' }, 'https://evil.com'),
    );
    expect(res.statusCode).toBe(403);
  });

  it('400 when query params missing', async () => {
    const res = await handler(createMockEvent(undefined));
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid schema (limit out of range)', async () => {
    const res = await handler(createMockEvent({ limit: '0' }));
    expect(res.statusCode).toBe(400);
  });

  it('500 when Secrets Manager fails', async () => {
    const {
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).rejects(new Error('secrets err'));

    const res = await handler(createMockEvent({ limit: '5' }));
    expect(res.statusCode).toBe(500);
  });

  it('500 when PG query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('query err'));
    const res = await handler(createMockEvent({ limit: '5' }));
    expect(res.statusCode).toBe(500);
  });

  /* ---------- env-var validation ---------- */

  describe('Environment variable validation (contents-read)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('throws when DB_SECRET_ARN missing', () => {
      delete process.env.DB_SECRET_ARN;
      expect(() => {
        require('@lambda/contents/read/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });

    it('throws when ORIGIN_ALLOWLIST missing / empty', () => {
      delete process.env.ORIGIN_ALLOWLIST;
      expect(() => {
        require('@lambda/contents/read/index');
      }).toThrow(
        'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
      );
    });
  });
});
