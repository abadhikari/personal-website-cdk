import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import { ACCOUNT_ID } from '../lib/configuration/account-config';

test('PhotosPageStack creates S3 Bucket and CloudFront Distribution', () => {
  const app = new cdk.App();

  const stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketName: `personal-website-photos-page-media-bucket-${ACCOUNT_ID}`,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
    },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256',
          },
        },
      ],
    },
  });

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
      },
    },
  });
});
