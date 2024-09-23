import * as cdk from 'aws-cdk-lib';
import { AccessLevel, Distribution, IDistribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CloudFrontDistributionProps {
  readonly s3Bucket: IBucket;
}

export class CloudFrontDistribution extends Construct {
  public readonly distribution: IDistribution;

  constructor(scope: Construct, id: string, props: CloudFrontDistributionProps) {
    super(scope, id);

    this.distribution = new Distribution(this, 'CloudFrontDistribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(props.s3Bucket, {
          originAccessLevels: [AccessLevel.READ],
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
  }
}