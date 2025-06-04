import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ReviewsPageStack } from '../lib/stacks/reviews-page-stack';

describe('ReviewsPageStack Tests', () => {
  let app: cdk.App;
  let stack: ReviewsPageStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new ReviewsPageStack(app, 'TestReviewsPageStack', {});
    template = Template.fromStack(stack);
  });

  test('VPC is created with the expected configuration', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
    });
  });

  test('RDS DB Instance is created', () => {
    template.resourceCountIs('AWS::RDS::DBInstance', 1);
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t4g.micro',
      Engine: 'postgres',
    });
  });

  test('Secrets Manager secret is created', () => {
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
  });

  test('RDS Subnet Group is created with the correct configuration', () => {
    template.resourceCountIs('AWS::RDS::DBSubnetGroup', 1);
    template.hasResourceProperties('AWS::RDS::DBSubnetGroup', {
      DBSubnetGroupDescription: 'Subnet group for Rds database',
    });
  });

  test('Only isolated subnets are created (no public or private subnets)', () => {
    const subnets = template.findResources('AWS::EC2::Subnet');
    expect(Object.keys(subnets).length).toBeGreaterThan(0);
    for (const subnetId of Object.keys(subnets)) {
      const subnet = subnets[subnetId];
      expect(subnet.Properties.Tags).toBeDefined();
      const subnetTypeTag = subnet.Properties.Tags.find(
        (tag: any) => tag.Key === 'aws-cdk:subnet-type',
      );
      expect(subnetTypeTag).toBeDefined();
      expect(subnetTypeTag.Value).toEqual('Isolated');
    }
  });
});
