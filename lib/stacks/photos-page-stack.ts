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
  private readonly readMediaLambda: LambdaFunction;

  private readonly writeMediaLambda: LambdaFunction;

  constructor(scope: Construct, id: string, props: PhotosPageStackProps) {
    super(scope, id, props);

    this.mediaBucket = new S3Bucket(this, 'MediaBucket', {
      bucketName: `personal-website-photos-page-media-bucket-${ACCOUNT_ID}`,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
    });

    this.mediaCdn = new CloudFrontDistribution(this, 'MediaCdn', {
      s3Bucket: this.mediaBucket.bucket,
    });

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
      }
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
      }
    );

    this.readMediaLambda = new LambdaFunction(this, 'ReadMediaLambda', {
      functionName: 'ReadMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      codeDirectory: 'lambda/media/read',
      handler: 'index.handler',
      environment: {
        ...PhotosPageDynamoDbTables,
      },
    });

    this.writeMediaLambda = new LambdaFunction(this, 'WriteMediaLambda', {
      functionName: 'WriteMediaLambdaFunction',
      runtime: Runtime.NODEJS_20_X,
      codeDirectory: 'lambda/media/write',
      handler: 'index.handler',
      environment: {
        ...PhotosPageDynamoDbTables,
      },
    });

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
      'v1',
      'media',
      'GET'
    );
    this.restApi.addLambdaIntegration(
      this.writeMediaLambda.function,
      'v1',
      'media',
      'POST'
    );
  }
}
