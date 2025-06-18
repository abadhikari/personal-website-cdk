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
    headers: { origin },
  };
}

describe('review write handler', () => {
  let handler: any;
  let secretsMock: ReturnType<typeof mockClient>;

  const VALID_SECRET = {
    username: 'user',
    password: 'pass',
    host: 'localhost',
    port: 5432,
    dbname: 'mydb',
  };

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
    queryMock.mockResolvedValue({});

    handler = require('@lambda/review/write/index').handler;
  });

  it('returns 200 and runs correct INSERT on valid body', async () => {
    const res = await handler(createMockEvent(JSON.stringify(VALID_BODY)));

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
      createMockEvent(JSON.stringify(VALID_BODY), 'https://evil.com'),
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
    const bad = { ...VALID_BODY, ratingx2: 42 };
    const res = await handler(createMockEvent(JSON.stringify(bad)));
    expect(res.statusCode).toBe(400);
  });

  it('500 when Secrets Manager fails', async () => {
    const {
      GetSecretValueCommand,
    } = require('@aws-sdk/client-secrets-manager');
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).rejects(new Error('secrets error'));

    const res = await handler(createMockEvent(JSON.stringify(VALID_BODY)));
    expect(res.statusCode).toBe(500);
  });

  it('500 when PG query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('query error'));
    const res = await handler(createMockEvent(JSON.stringify(VALID_BODY)));
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
