import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';
import { ACCOUNT_ID } from '../lib/configuration/account-config';
import { PhotosPageDynamoDbTables } from '../lib/configuration/dynamodb-config';

describe('PhotosPageStack', () => {
  let app: cdk.App;
  let stack: PhotosPageStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});
    template = Template.fromStack(stack);
  });

  test('Creates media S3 Bucket', () => {
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

  test('Creates media CloudFront Distribution', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https',
        },
      },
    });
  });

  test('Creates DynamoDb MediaMetadata Table and StackIdIndex GSI', () => {
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

  test('Creates DynamoDb StackMetadata Table and UploadTimestampIndex GSI', () => {
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

  test('Creates a Lambda function with environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Environment: {
        Variables: {
          STACK_METADATA_TABLE: PhotosPageDynamoDbTables.STACK_METADATA_TABLE,
          STACK_METADATA_GSI: PhotosPageDynamoDbTables.STACK_METADATA_GSI,
          MEDIA_METADATA_TABLE: PhotosPageDynamoDbTables.MEDIA_METADATA_TABLE,
          MEDIA_METADATA_GSI: PhotosPageDynamoDbTables.MEDIA_METADATA_GSI,
        },
      },
    });
  });

  test('Creates an API Gateway RestApi with CORS configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'MediaApi',
      Description: 'API for handling media on the photos page',
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'OPTIONS',
      RestApiId: { Ref: 'MediaApiApiGatewayRestApi0EA395C7' },
    });
  });

  test('Integrates Read Lambda with API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: { Ref: 'MediaApiApiGatewayRestApiv1mediaFA856210' },
      RestApiId: { Ref: 'MediaApiApiGatewayRestApi0EA395C7' },
      Integration: {
        Type: 'AWS_PROXY',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':apigateway:',
              { Ref: 'AWS::Region' },
              ':lambda:path/2015-03-31/functions/',
              {
                'Fn::GetAtt': ['ReadMediaLambdaLambdaFunction6051A5C0', 'Arn'],
              },
              '/invocations',
            ],
          ],
        },
      },
    });
  });
});
