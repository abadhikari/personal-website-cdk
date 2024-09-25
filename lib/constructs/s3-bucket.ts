import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
} from 'aws-cdk-lib/aws-s3';

export interface S3BucketProps {
  readonly bucketName: string;
  readonly removalPolicy: RemovalPolicy;
  readonly versioned: boolean;
}

export class S3Bucket extends Construct {
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
