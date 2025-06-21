import { deserializeOriginAllowlist } from '@lambda/common/cors';

/**
 * Interface for the configuration object.
 */
interface Config {
  STACK_METADATA_TABLE: string;
  ORIGIN_ALLOWLIST: string[];
}

/**
 * Loads and validates environment variables and returns the configuration object.
 * @returns {Config} The validated configuration.
 * @throws {Error} If any required environment variable is missing or invalid.
 */
export function getConfig(): Config {
  /**
   * The name of the DynamoDB table that stores stack metadata.
   */
  const STACK_METADATA_TABLE = process.env.STACK_METADATA_TABLE as string;
  /**
   * The allowlist for origins for cross-origin requests.
   */
  const ORIGIN_ALLOWLIST = deserializeOriginAllowlist(
    process.env.ORIGIN_ALLOWLIST,
  );

  // Validate Environment Variables
  if (!STACK_METADATA_TABLE) {
    throw new Error('STACK_METADATA_TABLE environment variable is missing.');
  }

  if (!ORIGIN_ALLOWLIST || ORIGIN_ALLOWLIST.length === 0) {
    throw new Error(
      'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
    );
  }

  return {
    STACK_METADATA_TABLE,
    ORIGIN_ALLOWLIST,
  };
}
