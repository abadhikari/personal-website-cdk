import createMockEvent from '@test-helpers/createMockEvent';

const queryMock = jest.fn();

jest.mock('@lambda/common/db', () => ({
  getDbCredentials: jest.fn(),
  getDbClient: jest.fn().mockResolvedValue({ query: queryMock }),
}));

describe('admin/query handler', () => {
  let handler: any;

  const VALID_QUERY = 'SELECT 1;';

  beforeAll(() => {
    process.env.DB_SECRET_ARN = 'mock-secret-arn';
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    queryMock.mockResolvedValue({ rows: [{ ok: true }] });

    handler = require('@lambda/admin/query/index').handler;
  });

  it('returns 200 on valid query', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: { query: VALID_QUERY },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Query executed successfully.');
    expect(queryMock).toHaveBeenCalledWith(VALID_QUERY);
  });

  it('400 when body missing', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 when invalid JSON', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: 'bad-json',
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('400 when schema fails', async () => {
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: { foo: 'bar' },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('500 on database query throw', async () => {
    queryMock.mockRejectedValueOnce(new Error('db broke'));
    const res = await handler(
      createMockEvent({
        httpMethod: 'POST',
        body: { query: VALID_QUERY },
      }),
    );
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
