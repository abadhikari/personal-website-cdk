import { RemovalPolicy, StackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
} from 'aws-cdk-lib/aws-dynamodb';
import { CloudFrontDistribution } from '../constructs/cloudfront-distribution';
import { S3Bucket } from '../constructs/s3-bucket';
import { ACCOUNT_ID } from '../configuration/account-config';
import { DynamoDbTable } from '../constructs/dynamodb-table';

export interface PhotosPageStackProps extends StackProps {}

/**
 * PhotosPageStack sets up the backend infrastructure for the photo page
 * of abhinnaadhikari.com.
 *
 * Resources include:
 * - S3 bucket for media storage
 * - CloudFront distribution for serving media
 * - DynamoDB tables for metadata management of media and stacks
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

    this.mediaMetadataTable = new DynamoDbTable(this, 'MediaMetadataTable', {
      tableName: 'MediaMetadataTable',
      partitionKey: { name: 'mediaId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
      billingMode: BillingMode.PAY_PER_REQUEST,
      gsis: [
        {
          indexName: 'StackIdIndex',
          partitionKey: { name: 'stackId', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
      ],
    });

    this.stackMetadataTable = new DynamoDbTable(this, 'StackMetadataTable', {
      tableName: 'StackMetadataTable',
      partitionKey: { name: 'stackId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
      billingMode: BillingMode.PAY_PER_REQUEST,
      gsis: [
        {
          indexName: 'UploadTimestampIndex',
          partitionKey: { name: 'stackId', type: AttributeType.STRING },
          sortKey: { name: 'uploadTimestamp', type: AttributeType.NUMBER },
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
