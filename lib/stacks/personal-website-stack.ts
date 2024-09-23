import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontDistribution } from '../components/cloudfront-distribution';
import { S3Bucket } from '../components/s3-bucket';

export interface PersonalWebsiteStackProps extends cdk.StackProps {
}

export class PersonalWebsiteStack extends cdk.Stack {
  private readonly s3Bucket: S3Bucket;
  private readonly cloudFrontDistribution: CloudFrontDistribution;

  constructor(scope: Construct, id: string, props: PersonalWebsiteStackProps) {
    super(scope, id, props);

    this.s3Bucket = new S3Bucket(this, "S3MediaBucket", {
      bucketName: 'personal-website-media-bucket-509399600387-us-east-1', 
    });

    this.cloudFrontDistribution = new CloudFrontDistribution(this, "CloudFrontMediaDistribution", {s3Bucket: this.s3Bucket.bucket})
  }
}
