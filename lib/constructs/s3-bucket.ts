import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
} from 'aws-cdk-lib/aws-s3';

export interface S3BucketProps {
  /**
   * The name of the S3 bucket.
   */
  readonly bucketName: string;
  /**
   * Specifies the removal policy for the bucket, determining
   * whether the bucket is retained or deleted when the stack is destroyed.
   */
  readonly removalPolicy: RemovalPolicy;
  /**
   * Specifies whether versioning is enabled for the S3 bucket.
   */
  readonly versioned: boolean;
}

/**
 * S3Bucket is a construct that creates an S3 bucket with custom settings.
 *
 * The bucket is encrypted, prevents public access, and enforces SSL connections.
 */
export class S3Bucket extends Construct {
  /**
   * The S3 bucket created by this construct.
   */
  public readonly bucket: IBucket;

  constructor(scope: Construct, id: string, props: S3BucketProps) {
    super(scope, id);
    this.bucket = new Bucket(this, 'S3Bucket', {
      bucketName: props.bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: props.versioned,
      removalPolicy: props.removalPolicy,
      publicReadAccess: false,
    });
  }
}
