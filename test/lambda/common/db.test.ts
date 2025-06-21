import { Client as PgClient } from 'pg';

const mockSend = jest.fn();
const mockConnect = jest.fn();
const mockQuery = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({ send: mockSend })),
  GetSecretValueCommand: jest.fn(),
}));

jest.mock('pg', () => ({
  Client: jest.fn(() => ({ connect: mockConnect, query: mockQuery })),
}));

describe('lambda/common/db utilities', () => {
  // Always reset module cache so cachedDb is cleared
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('getDbCredentials', () => {
    it('parses SecretString JSON into credential object', async () => {
      const secretString = JSON.stringify({
        username: 'user',
        password: 'pass',
        host: 'localhost',
        port: 5432,
        dbname: 'testdb',
      });
      mockSend.mockResolvedValueOnce({ SecretString: secretString });

      const { getDbCredentials } = require('@lambda/common/db');
      const creds = await getDbCredentials('mock‑arn');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(creds).toEqual({
        username: 'user',
        password: 'pass',
        host: 'localhost',
        port: 5432,
        dbname: 'testdb',
      });
    });

    it('returns empty credential fields when SecretString is missing', async () => {
      mockSend.mockResolvedValueOnce({});
      const { getDbCredentials } = require('@lambda/common/db');
      const creds = await getDbCredentials('mock‑arn');

      expect(creds).toEqual({
        username: undefined,
        password: undefined,
        host: undefined,
        port: undefined,
        dbname: undefined,
      });
    });
  });

  describe('getDbClient', () => {
    const creds = {
      username: 'user',
      password: 'pass',
      host: 'localhost',
      port: 5432,
      dbname: 'testdb',
    };

    it('creates and caches a pg client', async () => {
      const { getDbClient } = require('@lambda/common/db');

      const client1 = await getDbClient(creds);
      const client2 = await getDbClient(creds);

      // Cached instance
      expect(client1).toBe(client2); 
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeAtomicTransaction', () => {
    it('commits on success', async () => {
      const { executeAtomicTransaction } = require('@lambda/common/db');
      const db = { query: mockQuery } as unknown as PgClient;

      const queries = [{ sql: 'SQL', values: [] }];
      const fn = jest.fn().mockResolvedValue(undefined);

      await executeAtomicTransaction(db, queries, fn);

      expect(mockQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(fn).toHaveBeenCalledWith(db, queries);
      expect(mockQuery).toHaveBeenNthCalledWith(2, 'COMMIT');
    });

    it('rolls back on failure', async () => {
      const { executeAtomicTransaction } = require('@lambda/common/db');
      const db = { query: mockQuery } as unknown as PgClient;

      const queries = [{ sql: 'SQL', values: [] }];
      const fn = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(executeAtomicTransaction(db, queries, fn)).rejects.toThrow('boom');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('replacePlaceholders', () => {
    it('replaces placeholders when key is present', () => {
      const { replacePlaceholders } = require('@lambda/common/db');
      const values = ['static', ':ID', 99];
      const out = replacePlaceholders(values, { ':ID': 'xyz' });
      expect(out).toEqual(['static', 'xyz', 99]);
    });

    it('leaves values untouched when no match', () => {
      const { replacePlaceholders } = require('@lambda/common/db');
      const values = ['static', ':ID', 99];
      const out = replacePlaceholders(values, { ':OTHER': 'xyz' });
      expect(out).toEqual(['static', ':ID', 99]);
    });
  });
});
