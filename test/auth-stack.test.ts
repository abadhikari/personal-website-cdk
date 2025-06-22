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

  it('matches snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
