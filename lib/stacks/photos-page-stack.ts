import { RemovalPolicy, StackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { CloudFrontDistribution } from '../constructs/cloudfront-distribution';
import { S3Bucket } from '../constructs/s3-bucket';
import { ACCOUNT_ID } from '../configuration/account-config';
import { DynamoDbTable } from '../constructs/dynamodb-table';
import { ApiGatewayRestApi } from '../constructs/api-gateway-rest-api';
import { LambdaFunction } from '../constructs/lambda-function';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
import { WEBSITE_DOMAIN } from '../configuration/website-config';
import { PhotosPageDynamoDbTables } from '../configuration/dynamodb-config';
import { LambdaNodeFunction } from '../constructs/lambda-node-function';

export interface PhotosPageStackProps extends StackProps {}

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
   * The API Gateway REST API used for handling media-related HTTP requests on the photos page.
   */
  private readonly restApi: ApiGatewayRestApi;
  /**
   * The Lambda function responsible for reading (retrieving) media from the storage or database.
   * This function is integrated with a GET method in API Gateway.
   */
  private readonly readMediaLambda: LambdaNodeFunction;

  private readonly writeMediaLambda: LambdaNodeFunction;

  private readonly generateSignedMediaUrlsLambda: LambdaNodeFunction;

  constructor(scope: Construct, id: string, props: PhotosPageStackProps) {
    super(scope, id, props);

    // S3 Bucket
    this.mediaBucket = new S3Bucket(this, 'MediaBucket', {
      bucketName: `personal-website-photos-page-media-bucket-${ACCOUNT_ID}`,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
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
            partitionKey: { name: 'stackId', type: AttributeType.STRING },
            sortKey: { name: 'uploadTimestamp', type: AttributeType.NUMBER },
            projectionType: ProjectionType.ALL,
          },
        ],
      },
    );

    // Lambdas
    this.readMediaLambda = new LambdaNodeFunction(this, 'ReadMediaLambda', {
      functionName: 'ReadMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/media/read/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
      },
    });

    this.writeMediaLambda = new LambdaNodeFunction(this, 'WriteMediaLambda', {
      functionName: 'WriteMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/media/write/index.ts',
      handler: 'handler',
      environment: {
        ...PhotosPageDynamoDbTables,
      },
    });

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
          CDN_DOMAIN_URL: this.mediaCdn.distribution.distributionDomainName,
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

    // API Gateway
    this.restApi = new ApiGatewayRestApi(this, 'MediaApi', {
      restApiName: 'MediaApi',
      description: 'API for handling media on the photos page',
      cors: {
        allowMethods: Cors.ALL_METHODS,
        allowOrigins: [WEBSITE_DOMAIN],
      },
    });

    this.restApi.addLambdaIntegration(
      this.readMediaLambda.function,
      '/v1/media',
      'GET',
    );

    this.restApi.addLambdaIntegration(
      this.writeMediaLambda.function,
      '/v1/media',
      'POST',
    );

    this.restApi.addLambdaIntegration(
      this.generateSignedMediaUrlsLambda.function,
      'v1/media/upload-url',
      'GET',
    );
  }
}
