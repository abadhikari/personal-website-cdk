import { CfnOutput, Duration } from 'aws-cdk-lib';
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoPoolProps {
  /**
   * The name of the userPool.
   */
  readonly userPoolName: string;

  /**
   * The validity duration of the refresh token.
   */
  readonly refreshTokenValidity: Duration;

  /**
   * Defines the account recovery method for users who forget their credentials.
   */
  readonly accountRecovery: AccountRecovery;

  /**
   * Determines whether users can sign up on their own or must be manually created by an admin.
   */
  readonly selfSignUpEnabled: boolean;

  /**
   * Defines which login alias users can use (e.g., username, email, phone).
   */
  readonly signInAliases: {
    username?: boolean;
    email?: boolean;
    phone?: boolean;
  };

  /**
   * Specifies which attributes should be auto-verified by Cognito (email, phone).
   */
  readonly autoVerify?: {
    email?: boolean;
    phone?: boolean;
  };

  /**
   * Defines password policy (e.g., length, special characters).
   */
  readonly passwordPolicy?: {
    minLength?: number;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireDigits?: boolean;
    requireSymbols?: boolean;
  };

  /**
   * Defines standard attributes (e.g., email, phone).
   */
  readonly standardAttributes?: {
    email?: { required?: boolean; mutable?: boolean };
    phoneNumber?: { required?: boolean; mutable?: boolean };
  };

  /**
   * Defines which authentication flows are allowed (e.g., userPassword, adminInitiated).
   */
  readonly authFlows?: {
    userPassword?: boolean;
    adminUserPassword?: boolean;
    custom?: boolean;
    userSrp?: boolean;
  };

  /**
   * Defines the cognito domain name.
   */
  readonly domainPrefix?: string;

  /**
   * List of allowed callback URLs for the Cognito Hosted UI.
   */
  readonly callbackUrls: string[];

  /**
   * List of allowed logout URLs for the Cognito Hosted UI.
   */
  readonly logoutUrls?: string[];
}

/**
 * CognitoPool is a construct that creates an AWS Cognito User Pool with a secure authentication setup.
 *
 * This construct:
 * - Disables self-signup (manual user creation only).
 * - Enables authentication via username or email.
 * - Enforces email verification.
 * - Implements a strong password policy.
 * - Outputs the UserPool and UserPoolClient details.
 */
export class CognitoPool extends Construct {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoPoolProps) {
    super(scope, id);

    this.userPool = new UserPool(this, 'CognitoUserPool', {
      userPoolName: props.userPoolName,
      selfSignUpEnabled: props.selfSignUpEnabled,
      signInAliases: props.signInAliases,
      autoVerify: props.autoVerify,
      standardAttributes: props.standardAttributes,
      passwordPolicy: props.passwordPolicy,
      accountRecovery: props.accountRecovery,
    });

    this.userPoolClient = new UserPoolClient(this, 'CognitoUserPoolClient', {
      userPool: this.userPool,
      preventUserExistenceErrors: true,
      authFlows: props.authFlows ?? { userPassword: true },
      refreshTokenValidity: props.refreshTokenValidity,
      oAuth: {
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls ?? [],
      },
    });

    if (props.domainPrefix) {
      this.userPool.addDomain('CognitoDomain', {
        cognitoDomain: {
          domainPrefix: props.domainPrefix,
        },
      });
    }

    new CfnOutput(this, 'CognitoUserPoolId', {
      value: this.userPool.userPoolId,
    });
    new CfnOutput(this, 'CognitoUserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, 'CognitoDomain', {
      value: this.userPool.userPoolProviderUrl,
    });
  }
}
