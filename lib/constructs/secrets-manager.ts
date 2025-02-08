import { Construct } from 'constructs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export interface SecretsManagerProps {
  /**
   * The username for the secret.
   */
  readonly username: string;

  /**
   * The key that will be used to generate the secret password.
   * This key will be inserted into the generated secret string as the password value.
   */
  readonly generateStringKey: string;

  /**
   * The length of the password to be generated.
   * This determines the number of characters in the generated password.
   */
  readonly passwordLength: number;

  /**
   * Characters that will be excluded from the created secret.
   */
  readonly excludeCharacters: string;
}

/**
 * SecretsManager is a construct that creates a new secret in AWS Secrets Manager.
 *
 * It generates a secret string with a username and a randomly generated password.
 * The password is generated according to the specified length, and the secret can be used for
 * storing sensitive data like RDS credentials, API keys, etc.
 */
export class SecretsManager extends Construct {
  /**
   * The Secret created by this construct.
   */
  public readonly secret: Secret;

  constructor(scope: Construct, id: string, props: SecretsManagerProps) {
    super(scope, id);

    this.secret = new Secret(this, 'Secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.username }),
        generateStringKey: props.generateStringKey,
        passwordLength: props.passwordLength,
        excludeCharacters: props.excludeCharacters,
      },
    });
  }
}
