import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';

describe('AuthStack Tests', () => {
  let app: cdk.App;
  let stack: AuthStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new AuthStack(app, 'TestAuthStack', {});
    template = Template.fromStack(stack);
  });

  test('Cognito Admin User Pool Client is created', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      PreventUserExistenceErrors: 'ENABLED',
      ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      SupportedIdentityProviders: ['COGNITO'],
      TokenValidityUnits: { RefreshToken: 'minutes' },
      RefreshTokenValidity: 60,
      UserPoolId: { Ref: 'AdminAuthCognitoUserPoolBC6FC715' },
    });
  });
});
