import {
  AccessLevel,
  Distribution,
  IDistribution,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CloudFrontDistributionProps {
  /**
   * The S3 bucket that serves as the origin for the CloudFront distribution.
   */
  readonly s3Bucket: IBucket;
}

/**
 * CloudFrontDistribution is a construct that creates a CloudFront distribution with an S3 bucket as the origin.
 *
 * It enforces HTTPS for all viewers and sets up read-only access to the S3 bucket.
 */
export class CloudFrontDistribution extends Construct {
  /**
   * The CloudFront distribution created by this construct.
   */
  public readonly distribution: IDistribution;

  constructor(
    scope: Construct,
    id: string,
    props: CloudFrontDistributionProps,
  ) {
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
