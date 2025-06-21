import { deserializeOriginAllowlist } from '@lambda/common/cors';

/**
 * Interface for the configuration object.
 */
interface Config {
  DB_SECRET_ARN: string;
  ORIGIN_ALLOWLIST: string[];
}

/**
 * Loads and validates environment variables and returns the configuration object.
 * @returns {Config} The validated configuration.
 * @throws {Error} If any required environment variable is missing or invalid.
 */
export function getConfig(): Config {
  /**
   * The database secret arn.
   */
  const DB_SECRET_ARN = process.env.DB_SECRET_ARN as string;
  /**
   * The allowlist for origins for cross-origin requests.
   */
  const ORIGIN_ALLOWLIST = deserializeOriginAllowlist(
    process.env.ORIGIN_ALLOWLIST,
  );

  // Validate Environment Variables
  if (!DB_SECRET_ARN) {
    throw new Error('DB_SECRET_ARN environment variable is missing.');
  }

  if (!ORIGIN_ALLOWLIST || ORIGIN_ALLOWLIST.length === 0) {
    throw new Error(
      'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
    );
  }

  return {
    DB_SECRET_ARN,
    ORIGIN_ALLOWLIST,
  };
}
