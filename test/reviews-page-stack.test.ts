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

  test('matches snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('only isolated subnets are created', () => {
    const subnets = template.findResources('AWS::EC2::Subnet');
    expect(Object.keys(subnets).length).toBeGreaterThan(0);

    for (const subnet of Object.values(subnets)) {
      const tags = subnet.Properties.Tags;
      const subnetTypeTag = tags?.find((tag: any) => tag.Key === 'aws-cdk:subnet-type');
      expect(subnetTypeTag?.Value).toEqual('Isolated');
    }
  });

  test('creates RDS instance with correct config', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t4g.micro',
      Engine: 'postgres',
    });
  });
});
