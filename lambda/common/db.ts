import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { Client as PgClient } from 'pg';

import { QueryWithParams } from './types';

const secretsClient = new SecretsManagerClient({});
let cachedDb: PgClient | null = null;

/**
 * Retrieves database credentials from AWS Secrets Manager using the provided ARN.
 *
 * @param secretArn - The ARN of the secret to retrieve.
 * @returns Parsed credentials as an object with connection fields.
 */
export async function getDbCredentials(secretArn: string) {
  const secret = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  return JSON.parse(secret.SecretString ?? '{}') as {
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
  };
}

/**
 * Lazily connects and returns a cached PostgreSQL client.
 *
 * @param creds - The credentials object retrieved from Secrets Manager.
 * @returns Connected PostgreSQL client.
 */
export async function getDbClient(
  creds: Awaited<ReturnType<typeof getDbCredentials>>,
) {
  if (cachedDb) return cachedDb;

  const client = new PgClient({
    user: creds.username,
    password: creds.password,
    host: creds.host,
    port: creds.port,
    database: creds.dbname,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  cachedDb = client;
  return client;
}

/**
 * Executes a series of SQL queries within a single atomic database transaction.
 * Ensures that either all queries succeed and are committed, or all are rolled back on failure.
 *
 * @param db - A connected instance of a PostgreSQL client (`pg.Client`).
 * @param queries - An ordered list of parameterized SQL queries to be executed.
 * @param executeTransaction - A custom function that receives the DB client and query list,
 *                              responsible for executing the actual queries (e.g., with dynamic value injection).
 * @throws Re-throws any error encountered during execution after rolling back the transaction.
 */
export async function executeAtomicTransaction(
  db: PgClient,
  queries: QueryWithParams[],
  executeTransaction: (
    db: PgClient,
    queries: QueryWithParams[],
  ) => Promise<void>,
): Promise<void> {
  await db.query('BEGIN');
  try {
    await executeTransaction(db, queries);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/**
 * Replaces string placeholders in a values array with their actual values.
 * Useful for parameterized SQL queries that require late binding of dynamic values (e.g., content_id).
 *
 * @param values - An array of SQL parameter values, some of which may be string placeholders.
 * @param replacements - An object mapping placeholder strings to their corresponding real values.
 * @returns A new array with all recognized placeholders replaced.
 */
export function replacePlaceholders(
  values: any[],
  replacements: Record<string, any>,
) {
  return values.map((v) =>
    typeof v === 'string' && replacements[v] !== undefined
      ? replacements[v]
      : v,
  );
}
