import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontDistribution } from '../components/cloudfront-distribution';
import { S3Bucket } from '../components/s3-bucket';
import { ACCOUNT_ID } from '../configuration/account-config';

export interface PhotosPageStackProps extends cdk.StackProps {}

export class PhotosPageStack extends cdk.Stack {
  private readonly mediaBucket: S3Bucket;
  private readonly mediaCdn: CloudFrontDistribution;

  constructor(scope: Construct, id: string, props: PhotosPageStackProps) {
    super(scope, id, props);

    this.mediaBucket = new S3Bucket(this, 'MediaBucket', {
      bucketName: `personal-website-photos-page-media-bucket-${ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: false,
    });

    this.mediaCdn = new CloudFrontDistribution(
      this,
      'MediaCdn',
      { s3Bucket: this.mediaBucket.bucket }
    );
  }
}
