#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import {
  ACCOUNT_ID,
  ACCOUNT_REGION,
} from '../lib/configuration/account-config';
import { ReviewsPageStack } from '../lib/stacks/reviews-page-stack';

const app = new cdk.App();

const authStack = new AuthStack(app, 'AuthStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
});

new PhotosPageStack(app, 'PhotosPageStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
  authStack,
});

new ReviewsPageStack(app, 'ReviewsPageStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
});
