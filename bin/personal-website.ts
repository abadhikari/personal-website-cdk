#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebsiteStack } from '../lib/stacks/personal-website-stack';

const app = new cdk.App();

new PersonalWebsiteStack(app, 'PersonalWebsiteStack', {
  env: { account: '509399600387', region: 'us-east-1' }
});
