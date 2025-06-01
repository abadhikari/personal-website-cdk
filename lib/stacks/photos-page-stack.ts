import { RemovalPolicy, StackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { HttpMethods } from 'aws-cdk-lib/aws-s3';
import { CloudFrontDistribution } from '../constructs/cloudfront-distribution';
import { S3Bucket } from '../constructs/s3-bucket';
import { ACCOUNT_ID } from '../configuration/account-config';
import { DynamoDbTable } from '../constructs/dynamodb-table';
import { ORIGIN_ALLOWLIST } from '../configuration/website-config';
import { PhotosPageDynamoDbTables } from '../configuration/dynamodb-config';
import { LambdaNodeFunction } from '../constructs/lambda-node-function';
import { AuthStack } from './auth-stack';

export interface PhotosPageStackProps extends StackProps {
  authStack: AuthStack;
}

/**
 * PhotosPageStack sets up the backend infrastructure for the photo page
 * of abhinnaadhikari.com.
 *
 * Resources include:
 * - S3 bucket for media storage
 * - CloudFront distribution for serving media
 * - DynamoDB tables for metadata management of media and stacks
 * - API Gateway Rest API
 * - Lambda Functions that interact with the above resources
 */
export class PhotosPageStack extends Stack {
  /**
   * S3 bucket for storing media assets (photos and videos).
   */
  private readonly mediaBucket: S3Bucket;
  /**
   * CloudFront CDN for efficiently serving media assets from the mediaBucket.
   */
  private readonly mediaCdn: CloudFrontDistribution;

  /**
   * DynamoDB table to store metadata about individual media files.
   */
  private readonly mediaMetadataTable: DynamoDbTable;
  /**
   * DynamoDB table to store metadata about media stacks (e.g., albums).
   */
  private readonly stackMetadataTable: DynamoDbTable;

  /**
   * The Lambda function responsible for reading (retrieving) media from the storage or database.
   * This function is integrated with a GET method in API Gateway.
   */
  public readonly readMediaLambda: LambdaNodeFunction;

  public readonly writeMediaLambda: LambdaNodeFunction;

  public readonly deleteMediaLambda: LambdaNodeFunction;

  public readonly generateSignedMediaUrlsLambda: LambdaNodeFunction;

  public readonly editStackMetadataLambda: LambdaNodeFunction;

  constructor(scope: Construct, id: string, props: PhotosPageStackProps) {
    super(scope, id, props);

    // S3 Bucket
    this.mediaBucket = new S3Bucket(this, 'MediaBucket', {
      bucketName: `personal-website-photos-page-media-bucket-${ACCOUNT_ID}`,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
      corsRules: [
        {
          allowedOrigins: ORIGIN_ALLOWLIST,
          allowedMethods: [HttpMethods.PUT],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'x-amz-security-token',
            'x-amz-content-sha256',
          ],
        },
      ],
    });

    // CloudFront Distribution
    this.mediaCdn = new CloudFrontDistribution(this, 'MediaCdn', {
      s3Bucket: this.mediaBucket.bucket,
    });

    // DynamoDb Tables
    this.mediaMetadataTable = new DynamoDbTable(
      this,
      PhotosPageDynamoDbTables.MEDIA_METADATA_TABLE,
      {
        tableName: PhotosPageDynamoDbTables.MEDIA_METADATA_TABLE,
        partitionKey: { name: 'mediaId', type: AttributeType.STRING },
        removalPolicy: RemovalPolicy.RETAIN,
        billingMode: BillingMode.PAY_PER_REQUEST,
        gsis: [
          {
            indexName: PhotosPageDynamoDbTables.MEDIA_METADATA_GSI,
            partitionKey: { name: 'stackId', type: AttributeType.STRING },
            projectionType: ProjectionType.ALL,
          },
        ],
      },
    );

    this.stackMetadataTable = new DynamoDbTable(
      this,
      PhotosPageDynamoDbTables.STACK_METADATA_TABLE,
      {
        tableName: PhotosPageDynamoDbTables.STACK_METADATA_TABLE,
        partitionKey: { name: 'stackId', type: AttributeType.STRING },
        removalPolicy: RemovalPolicy.RETAIN,
        billingMode: BillingMode.PAY_PER_REQUEST,
        gsis: [
          {
            indexName: PhotosPageDynamoDbTables.STACK_METADATA_GSI,
            partitionKey: { name: 'staticKey', type: AttributeType.STRING },
            sortKey: { name: 'uploadTimestamp', type: AttributeType.NUMBER },
            projectionType: ProjectionType.ALL,
          },
        ],
      },
    );

    // Lambdas
    const serializedOriginAllowList = ORIGIN_ALLOWLIST.join(',');

    this.readMediaLambda = new LambdaNodeFunction(this, 'ReadMediaLambda', {
      functionName: 'ReadMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/media/read/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    // Grant the read lambda read permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantReadData(this.readMediaLambda.function);
    this.mediaMetadataTable.table.grantReadData(this.readMediaLambda.function);

    const adminCognitoPoolDomain =
      props.authStack.adminPool.userPool.userPoolProviderUrl;

    this.writeMediaLambda = new LambdaNodeFunction(this, 'WriteMediaLambda', {
      functionName: 'WriteMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/media/write/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        CDN_DOMAIN_URL: this.mediaCdn.distribution.distributionDomainName,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
        ADMIN_COGNITO_POOL_DOMAIN: adminCognitoPoolDomain,
      },
    });

    // Grant the write lambda write permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantWriteData(
      this.writeMediaLambda.function,
    );
    this.mediaMetadataTable.table.grantWriteData(
      this.writeMediaLambda.function,
    );

    this.deleteMediaLambda = new LambdaNodeFunction(this, 'DeleteMediaLambda', {
      functionName: 'DeleteMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/media/delete/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
        S3_BUCKET_NAME: this.mediaBucket.bucket.bucketName,
      },
    });

    // Grant the delete lambda read and write permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantReadWriteData(
      this.deleteMediaLambda.function,
    );
    this.mediaMetadataTable.table.grantReadWriteData(
      this.deleteMediaLambda.function,
    );
    this.mediaBucket.bucket.grantDelete(this.deleteMediaLambda.function);

    this.editStackMetadataLambda = new LambdaNodeFunction(
      this,
      'EditStackMetadataLambda',
      {
        functionName: 'EditStackMetadataLambdaFunction',
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/stack/edit/index.ts',
        handler: 'handler',
        environment: {
          ...PhotosPageDynamoDbTables,
          ORIGIN_ALLOWLIST: serializedOriginAllowList,
        },
      },
    );

    // Grant the edit stack lambda write permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantWriteData(
      this.editStackMetadataLambda.function,
    );

    this.generateSignedMediaUrlsLambda = new LambdaNodeFunction(
      this,
      'GenerateSignedMediaUrlLambda',
      {
        functionName: 'GenerateSignedMediaUrlLambdaFunction',
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/media/generate-signed-urls/index.ts',
        handler: 'handler',
        environment: {
          S3_BUCKET_NAME: this.mediaBucket.bucket.bucketName,
          S3_URL_TTL: '300',
          ORIGIN_ALLOWLIST: serializedOriginAllowList,
          ADMIN_COGNITO_POOL_DOMAIN: adminCognitoPoolDomain,
        },
      },
    );

    this.generateSignedMediaUrlsLambda.node.addDependency(
      this.mediaCdn.distribution,
    );

    // Grant S3 permissions to the Lambda to generate signed URLs
    this.mediaBucket.bucket.grantPut(
      this.generateSignedMediaUrlsLambda.function,
    );
  }
}
