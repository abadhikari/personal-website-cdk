import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { ApiStack } from '../lib/stacks/api-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import { ReviewsPageStack } from '../lib/stacks/reviews-page-stack';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
const mutating: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

describe('ApiStack – single snapshot + invariants', () => {
  const app = new cdk.App();

  const auth = new AuthStack(app, 'Auth', {});
  const photos = new PhotosPageStack(app, 'Photos', {});
  const reviews = new ReviewsPageStack(app, 'Reviews', {});

  const api = new ApiStack(app, 'Api', {
    adminPool: auth.adminPool,
    media: {
      generateSignedUrlsLambda: photos.generateSignedMediaUrlsLambda,
      deleteLambda: photos.deleteMediaLambda,
    },
    stack: {
      writeLambda: photos.writeStackLambda,
      readLambda: photos.readStackLambda,
      editLambda: photos.editStackMetadataLambda,
    },
    stacks: { readLambda: photos.readStacksLambda },
    content: { writeLambda: reviews.writeContentLambda },
    contents: { readLambda: reviews.readContentsLambda },
    review: { writeLambda: reviews.writeReviewLambda },
    reviews: { readLambda: reviews.readReviewsLambda },
    lookups: {
      readLambda: reviews.readLookupsLambda,
      writeLambda: reviews.writeLookupsLambda,
    },
  });

  const template = Template.fromStack(api);

  it('matches snapshot and enforces auth + wiring rules', () => {
    expect(template.toJSON()).toMatchSnapshot();

    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'AbhinnaAdhikariApi',
      Description: 'Central API for abhinnaadhikari.com website endpoints',
    });

    const methods = template.findResources('AWS::ApiGateway::Method');
    for (const methodRes of Object.values(methods)) {
      const http = methodRes.Properties.HttpMethod as HttpMethod;
      const authType = methodRes.Properties.AuthorizationType;

      if (mutating.includes(http)) {
        expect(authType).toBe('COGNITO_USER_POOLS');
      } else {
        expect(authType).not.toBe('COGNITO_USER_POOLS');
      }
    }
  });
});
