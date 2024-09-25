import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import { ACCOUNT_ID } from '../lib/configuration/account-config';

test('PhotosPageStack creates media S3 Bucket', () => {
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
});

test('PhotosPageStack creates media CloudFront Distribution', () => {
  const app = new cdk.App();
  const stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
      },
    },
  });
});

test('PhotosPageStack creates DynamoDb MediaMetadata Table and StackIdIndex GSI', () => {
  const app = new cdk.App();
  const stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'MediaMetadataTable',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'mediaId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'mediaId', AttributeType: 'S' },
      { AttributeName: 'stackId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'StackIdIndex',
        KeySchema: [{ AttributeName: 'stackId', KeyType: 'HASH' }],
        Projection: {
          ProjectionType: 'ALL',
        },
      },
    ],
  });
});

test('PhotosPageStack creates DynamoDb StackMetadata Table and UploadTimestampIndex GSI', () => {
  const app = new cdk.App();
  const stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'StackMetadataTable',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'stackId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'stackId', AttributeType: 'S' },
      { AttributeName: 'uploadTimestamp', AttributeType: 'N' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UploadTimestampIndex',
        KeySchema: [
          { AttributeName: 'stackId', KeyType: 'HASH' },
          { AttributeName: 'uploadTimestamp', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
      },
    ],
  });
});
