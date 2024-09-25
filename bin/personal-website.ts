#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import {
  ACCOUNT_ID,
  ACCOUNT_REGION,
} from '../lib/configuration/account-config';

const app = new cdk.App();

new PhotosPageStack(app, 'PhotosPageStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
});
