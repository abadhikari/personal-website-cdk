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
   * The Lambda function responsible for reading (retrieving) stacks and corresponding media
   * from the storage or database.
   */
  public readonly readStacksLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for reading (retrieving) a specific stack and the
   * corresponding media from the storage or database.
   */
  public readonly readStackLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for writing a stack and corresponding media
   * metadata to the database.
   */
  public readonly writeStackLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for deleting a stack and corresponding media
   * metadata from the database.
   */
  public readonly deleteMediaLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for producing s3 signedUrls that allow the user
   * to upload files.
   */
  public readonly generateSignedMediaUrlsLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for editing a stack
   * metadata in the database.
   */
  public readonly editStackMetadataLambda: LambdaNodeFunction;

  constructor(scope: Construct, id: string, props: StackProps) {
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

    this.readStacksLambda = new LambdaNodeFunction(this, 'ReadStacksLambda', {
      functionName: 'photos_page_read_stacks_v1',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/stacks/read/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    // Grant the read stacks lambda read permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantReadData(this.readStacksLambda.function);
    this.mediaMetadataTable.table.grantReadData(this.readStacksLambda.function);

    this.readStackLambda = new LambdaNodeFunction(this, 'ReadStackLambda', {
      functionName: 'photos_page_read_stack_v1',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/stack/read/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    // Grant the read stack lambda read permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantReadData(this.readStackLambda.function);
    this.mediaMetadataTable.table.grantReadData(this.readStackLambda.function);

    this.writeStackLambda = new LambdaNodeFunction(this, 'WriteStackLambda', {
      functionName: 'photos_page_write_stack_v1',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/stack/write/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
        CDN_DOMAIN_URL: this.mediaCdn.distribution.distributionDomainName,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    // Grant the write lambda write permissions to the dynamoDb tables
    this.stackMetadataTable.table.grantWriteData(
      this.writeStackLambda.function,
    );
    this.mediaMetadataTable.table.grantWriteData(
      this.writeStackLambda.function,
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
