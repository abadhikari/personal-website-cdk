import { deserializeOriginAllowlist } from '../../common/cors';

/**
 * Interface for the configuration object.
 */
interface Config {
  S3_BUCKET_NAME: string;
  S3_URL_TTL: number;
  ORIGIN_ALLOWLIST: string[];
  ADMIN_COGNITO_POOL_DOMAIN: string;
}

/**
 * Loads and validates environment variables and returns the configuration object.
 * @returns {Config} The validated configuration.
 * @throws {Error} If any required environment variable is missing or invalid.
 */
export function getConfig(): Config {
  /**
   * The name of the S3 Bucket to generate signed URLs for.
   */
  const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
  /**
   * The time to live value (in seconds) for the generated signed urls.
   */
  const S3_URL_TTL = Number(process.env.S3_URL_TTL);
  /**
   * The allowlist for origins for cross-origin requests.
   */
  const ORIGIN_ALLOWLIST = deserializeOriginAllowlist(
    process.env.ORIGIN_ALLOWLIST,
  );
  /**
   * The admin cognito pool domain used to find the jwks public key.
   */
  const ADMIN_COGNITO_POOL_DOMAIN = process.env
    .ADMIN_COGNITO_POOL_DOMAIN as string;

  // Validate Environment Variables
  if (!S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME environment variable is missing.');
  }

  if (!S3_URL_TTL || isNaN(S3_URL_TTL)) {
    throw new Error(
      'S3_URL_TTL environment variable is missing or not a valid number.',
    );
  }

  if (!ORIGIN_ALLOWLIST || ORIGIN_ALLOWLIST.length === 0) {
    throw new Error(
      'ORIGIN_ALLOWLIST environment variable is missing or empty list.',
    );
  }

  if (!ADMIN_COGNITO_POOL_DOMAIN) {
    throw new Error(
      'ADMIN_COGNITO_POOL_DOMAIN environment variable is missing.',
    );
  }

  return {
    S3_BUCKET_NAME,
    S3_URL_TTL,
    ORIGIN_ALLOWLIST,
    ADMIN_COGNITO_POOL_DOMAIN,
  };
}
