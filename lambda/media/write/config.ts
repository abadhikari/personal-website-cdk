import { deserializeOriginAllowlist } from '../../common/cors';

/**
 * Interface for the configuration object.
 */
interface Config {
  STACK_METADATA_TABLE: string;
  MEDIA_METADATA_TABLE: string;
  ORIGIN_ALLOWLIST: string[];
  STACK_METADATA_GSI_PARTITION_KEY: string;
  CDN_DOMAIN_URL: string;
  ADMIN_COGNITO_POOL_DOMAIN: string;
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
   * The name of the DynamoDB table that stores media metadata.
   */
  const MEDIA_METADATA_TABLE = process.env.MEDIA_METADATA_TABLE as string;
  /**
   * The CDN domain URL.
   */
  const CDN_DOMAIN_URL = process.env.CDN_DOMAIN_URL as string;
  /**
   * The allowlist for origins for cross-origin requests.
   */
  const ORIGIN_ALLOWLIST = deserializeOriginAllowlist(
    process.env.ORIGIN_ALLOWLIST,
  );
  /**
   * The static key of the Global Secondary Index (GSI) used to query stack metadata.
   */
  const STACK_METADATA_GSI_PARTITION_KEY = process.env
    .STACK_METADATA_GSI_PARTITION_KEY as string;
  /**
   * The admin cognito pool domain used to find the jwks public key.
   */
  const ADMIN_COGNITO_POOL_DOMAIN = process.env
    .ADMIN_COGNITO_POOL_DOMAIN as string;

  // Validate Environment Variables
  if (!STACK_METADATA_TABLE) {
    throw new Error('STACK_METADATA_TABLE environment variable is missing.');
  }

  if (!MEDIA_METADATA_TABLE) {
    throw new Error('MEDIA_METADATA_TABLE environment variable is missing.');
  }

  if (!CDN_DOMAIN_URL) {
    throw new Error('CDN_DOMAIN_URL environment variable is missing.');
  }

  if (!ORIGIN_ALLOWLIST || ORIGIN_ALLOWLIST.length === 0) {
    throw new Error(
      'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
    );
  }

  if (!STACK_METADATA_GSI_PARTITION_KEY) {
    throw new Error(
      'STACK_METADATA_GSI_PARTITION_KEY environment variable is missing.',
    );
  }

  if (!ADMIN_COGNITO_POOL_DOMAIN) {
    throw new Error(
      'ADMIN_COGNITO_POOL_DOMAIN environment variable is missing.',
    );
  }

  return {
    STACK_METADATA_TABLE,
    MEDIA_METADATA_TABLE,
    ORIGIN_ALLOWLIST,
    STACK_METADATA_GSI_PARTITION_KEY,
    CDN_DOMAIN_URL,
    ADMIN_COGNITO_POOL_DOMAIN,
  };
}
