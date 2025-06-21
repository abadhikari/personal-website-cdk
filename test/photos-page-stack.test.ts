import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';

describe('PhotosPageStack Tests', () => {
  let app: cdk.App;
  let stack: PhotosPageStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new PhotosPageStack(app, 'TestPhotosPageStack', {});
    template = Template.fromStack(stack);
  });

  test('matches snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
