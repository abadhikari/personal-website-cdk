import jwksClient from 'jwks-rsa';
import { decode, verify, JwtHeader } from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

/**
 * Creates a JWKS (JSON Web Key Set) client to retrieve public signing keys from Cognito pool.
 * @param {string} cognitoPoolDomain - The domain of the Cognito user pool.
 * @returns {jwksClient.JwksClient} - The JWKS client instance.
 */
function createJwksClient(cognitoPoolDomain: string) {
  const jwksUri = `${cognitoPoolDomain}/.well-known/jwks.json`;
  return jwksClient({
    jwksUri,
  });
}

/**
 * Retrieves the public key from the JWKS endpoint using the `kid` (Key ID) from the JWT header.
 * @param {JwtHeader} header - The JWT header containing the Key ID (`kid`).
 * @param {jwksClient.JwksClient} client - The JWKS client instance.
 * @returns {Promise<string>} - The public key as a string.
 * @throws {UnauthorizedError} - If the key cannot be retrieved.
 */
async function getPublicKey(
  header: JwtHeader,
  client: jwksClient.JwksClient,
): Promise<string> {
  try {
    const key = await client.getSigningKey(header.kid);
    return key.getPublicKey();
  } catch (error) {
    throw new UnauthorizedError(
      `Error retrieving signing key: ${(error as Error).message}`,
    );
  }
}

/**
 * Authenticates and verifies a JWT token using the public key from Cognito.
 * @param {string} token - The JWT token to authenticate.
 * @param {string} cognitoPoolDomain - The domain of the Cognito user pool.
 * @throws {UnauthorizedError} - If the token is invalid or cannot be verified.
 */
export async function authenticateToken(
  token: string,
  cognitoPoolDomain: string,
) {
  const decoded = decode(token, { complete: true }) as { header?: JwtHeader };
  if (!decoded?.header) {
    throw new UnauthorizedError('Invalid token format');
  }

  const client = createJwksClient(cognitoPoolDomain);
  const publicKey = await getPublicKey(decoded.header, client);

  try {
    verify(token, publicKey, { algorithms: ['RS256'] });
  } catch (error) {
    throw new UnauthorizedError(
      `Error fetching public key or verifying token ${(error as Error).message}`,
    );
  }
}
