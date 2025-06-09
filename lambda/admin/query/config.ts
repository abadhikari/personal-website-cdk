/**
 * Interface for the configuration object.
 */
interface Config {
  DB_SECRET_ARN: string;
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

  // Validate Environment Variables
  if (!DB_SECRET_ARN) {
    throw new Error('DB_SECRET_ARN environment variable is missing.');
  }

  return {
    DB_SECRET_ARN,
  };
}
