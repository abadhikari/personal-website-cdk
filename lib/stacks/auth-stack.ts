import { Duration, StackProps, Stack } from 'aws-cdk-lib';
import { AccountRecovery } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

import {
  LOCALHOST_DOMAIN,
  WEBSITE_DOMAIN,
} from '../configuration/website-config';
import { CognitoPool } from '../constructs/cognito-pool';

/**
 * AuthStack sets up the backend infrastructure for all things
 * authentication-related on abhinnaadhikari.com.
 *
 * Resources include:
 * - Cognito Admin User pool.
 *
 * Stack Outputs:
 * - AdminCognitoUserPoolId: The ID of the Cognito User Pool.
 * - AdminCognitoUserPoolClientId: The App Client ID of the Cognito User Pool.
 */
export class AuthStack extends Stack {
  public readonly adminPool: CognitoPool;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Cognito
    this.adminPool = new CognitoPool(this, 'AdminAuth', {
      userPoolName: 'abhinnaadhikari-admin-user-pool',
      refreshTokenValidity: Duration.hours(1),
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      authFlows: {
        userSrp: true,
      },
      domainPrefix: 'abhinnaadhikari-admin',
      callbackUrls: [
        `${WEBSITE_DOMAIN}/callback`,
        `${LOCALHOST_DOMAIN}/callback`,
      ],
      logoutUrls: [WEBSITE_DOMAIN, LOCALHOST_DOMAIN],
    });
  }
}
