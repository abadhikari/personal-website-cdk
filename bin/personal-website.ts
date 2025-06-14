#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApiStack } from '../lib/stacks/api-stack';
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

const photosPageStack = new PhotosPageStack(app, 'PhotosPageStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
});

const reviewsPageStack = new ReviewsPageStack(app, 'ReviewsPageStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
});

new ApiStack(app, 'ApiStack', {
  env: { account: ACCOUNT_ID, region: ACCOUNT_REGION },
  adminPool: authStack.adminPool,
  media: {
    deleteLambda: photosPageStack.deleteMediaLambda,
    generateSignedUrlsLambda: photosPageStack.generateSignedMediaUrlsLambda,
  },
  stack: {
    editLambda: photosPageStack.editStackMetadataLambda,
    readLambda: photosPageStack.readStackLambda,
    writeLambda: photosPageStack.writeStackLambda,
  },
  stacks: {
    readLambda: photosPageStack.readStacksLambda,
  },
  content: {
    writeLambda: reviewsPageStack.writeContentLambda,
  },
});
