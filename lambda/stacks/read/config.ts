import { deserializeOriginAllowlist } from '../../common/cors';

/**
 * Interface for the configuration object.
 */
interface Config {
  STACK_METADATA_TABLE: string;
  STACK_METADATA_GSI: string;
  MEDIA_METADATA_TABLE: string;
  MEDIA_METADATA_GSI: string;
  ORIGIN_ALLOWLIST: string[];
  STACK_METADATA_GSI_PARTITION_KEY: string;
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
   * The name of the Global Secondary Index (GSI) used to query stack metadata by upload timestamp.
   */
  const STACK_METADATA_GSI = process.env.STACK_METADATA_GSI as string;
  /**
   * The name of the DynamoDB table that stores media metadata.
   */
  const MEDIA_METADATA_TABLE = process.env.MEDIA_METADATA_TABLE as string;
  /**
   * The name of the Global Secondary Index (GSI) used to query media metadata by stack ID.
   */
  const MEDIA_METADATA_GSI = process.env.MEDIA_METADATA_GSI as string;
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

  // Validate Environment Variables
  if (!STACK_METADATA_TABLE) {
    throw new Error('STACK_METADATA_TABLE environment variable is missing.');
  }

  if (!STACK_METADATA_GSI) {
    throw new Error('STACK_METADATA_GSI environment variable is missing.');
  }

  if (!MEDIA_METADATA_TABLE) {
    throw new Error('MEDIA_METADATA_TABLE environment variable is missing.');
  }

  if (!MEDIA_METADATA_GSI) {
    throw new Error('MEDIA_METADATA_GSI environment variable is missing.');
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

  return {
    STACK_METADATA_TABLE,
    STACK_METADATA_GSI,
    MEDIA_METADATA_TABLE,
    MEDIA_METADATA_GSI,
    ORIGIN_ALLOWLIST,
    STACK_METADATA_GSI_PARTITION_KEY,
  };
}
