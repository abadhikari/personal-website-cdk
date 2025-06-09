import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';

const connectMock = jest.fn();
const queryMock = jest.fn();

jest.mock('pg', () => ({
  Client: jest.fn(() => ({ connect: connectMock, query: queryMock })),
}));

describe('admin/query handler', () => {
  let handler: any;
  let secretsMock: ReturnType<typeof mockClient>;

  const VALID_SECRET = {
    username: 'user',
    password: 'pass',
    host: 'localhost',
    port: 5432,
    dbname: 'mydb',
  };

  const VALID_QUERY = 'SELECT 1;';
  const evt = (body: any): Partial<APIGatewayProxyEvent> => ({
    body,
    httpMethod: 'POST',
  });

  beforeAll(() => {
    process.env.DB_SECRET_ARN = 'mock-secret-arn';
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

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
    queryMock.mockResolvedValue({ rows: [{ ok: true }] });

    handler = require('@lambda/admin/query/index').handler;
  });

  it('returns 200 on valid query', async () => {
    const res = await handler(evt(JSON.stringify({ query: VALID_QUERY })));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Query executed successfully.');
    expect(queryMock).toHaveBeenCalledWith(VALID_QUERY);
  });

  it('400 when body missing', async () => {
    const res = await handler(evt(undefined));
    expect(res.statusCode).toBe(400);
  });

  it('400 when invalid JSON', async () => {
    const res = await handler(evt('bad-json'));
    expect(res.statusCode).toBe(400);
  });

  it('400 when schema fails', async () => {
    const res = await handler(evt(JSON.stringify({ foo: 'bar' })));
    expect(res.statusCode).toBe(400);
  });

  it('500 on Secrets Manager error', async () => {
    const {
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).rejects(new Error('boom'));

    const res = await handler(evt(JSON.stringify({ query: VALID_QUERY })));
    expect(res.statusCode).toBe(500);
  });

  it('500 on PG query throw', async () => {
    queryMock.mockRejectedValueOnce(new Error('db broke'));
    const res = await handler(evt(JSON.stringify({ query: VALID_QUERY })));
    expect(res.statusCode).toBe(500);
  });
  describe('Environment variable validation (admin query Lambda)', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('throws when DB_SECRET_ARN is missing', () => {
      delete process.env.DB_SECRET_ARN;

      expect(() => {
        require('@lambda/admin/query/index');
      }).toThrow('DB_SECRET_ARN environment variable is missing.');
    });
  });
});
