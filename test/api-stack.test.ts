import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/stacks/api-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { PhotosPageStack } from '../lib/stacks/photos-page-stack';

describe('ApiStack Tests', () => {
  let app: cdk.App;
  let authStack: AuthStack;
  let photosPageStack: PhotosPageStack;
  let stack: ApiStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    authStack = new AuthStack(app, 'TestAuthStack', {});
    photosPageStack = new PhotosPageStack(app, 'TestPhotosPageStack', {
      authStack,
    });
    stack = new ApiStack(app, 'TestApiStack', {
      adminPool: authStack.adminPool,
      media: {
        generateSignedUrlsLambda: photosPageStack.generateSignedMediaUrlsLambda,
        deleteLambda: photosPageStack.deleteMediaLambda,
      },
      stack: {
        writeLambda: photosPageStack.writeStackLambda,
        editLambda: photosPageStack.editStackMetadataLambda,
      },
      stacks: {
        readLambda: photosPageStack.readStacksLambda,
      },
    });
    template = Template.fromStack(stack);
  });

  test('Creates an API Gateway RestApi with CORS configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'AbhinnaAdhikariApi',
      Description: 'Central API for abhinnaadhikari.com website endpoints',
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'OPTIONS',
      RestApiId: { Ref: 'SiteApiApiGatewayRestApi2686602D' },
    });
  });

  test('Integrates Read Lambda with API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: { Ref: 'SiteApiApiGatewayRestApiv1stacks8FB6C6CF' },
      RestApiId: { Ref: 'SiteApiApiGatewayRestApi2686602D' },
      Integration: {
        Type: 'AWS_PROXY',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':apigateway:',
              { Ref: 'AWS::Region' },
              ':lambda:path/2015-03-31/functions/',
              {
                'Fn::ImportValue':
                  'TestPhotosPageStack:ExportsOutputFnGetAttReadStacksLambdaLambdaNodeFunction7483E2A3Arn5705DD9E',
              },
              '/invocations',
            ],
          ],
        },
      },
    });
  });

  test('Integrates Write Lambda with API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: { Ref: 'SiteApiApiGatewayRestApiv1stack2EC88AE9' },
      RestApiId: { Ref: 'SiteApiApiGatewayRestApi2686602D' },
      Integration: {
        Type: 'AWS_PROXY',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':apigateway:',
              { Ref: 'AWS::Region' },
              ':lambda:path/2015-03-31/functions/',
              {
                'Fn::ImportValue':
                  'TestPhotosPageStack:ExportsOutputFnGetAttWriteStackLambdaLambdaNodeFunction68AC7CA2Arn27CD2DA9',
              },
              '/invocations',
            ],
          ],
        },
      },
    });
  });

  test('Integrates GetSignedUrls Lambda with API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: { Ref: 'SiteApiApiGatewayRestApiv1mediauploadurl5F22BCAC' },
      RestApiId: { Ref: 'SiteApiApiGatewayRestApi2686602D' },
      Integration: {
        Type: 'AWS_PROXY',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':apigateway:',
              { Ref: 'AWS::Region' },
              ':lambda:path/2015-03-31/functions/',
              {
                'Fn::ImportValue':
                  'TestPhotosPageStack:ExportsOutputFnGetAttGenerateSignedMediaUrlLambdaLambdaNodeFunction1363B525Arn8B5DEA58',
              },
              '/invocations',
            ],
          ],
        },
      },
    });
  });

  test('Integrates Delete Lambda with API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'DELETE',
      ResourceId: { Ref: 'SiteApiApiGatewayRestApiv1mediaD83F5FBB' },
      RestApiId: { Ref: 'SiteApiApiGatewayRestApi2686602D' },
      AuthorizationType: 'COGNITO_USER_POOLS',
      AuthorizerId: {
        Ref: 'ApiAuthorizer68095F41',
      },
      Integration: {
        Type: 'AWS_PROXY',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':apigateway:',
              { Ref: 'AWS::Region' },
              ':lambda:path/2015-03-31/functions/',
              {
                'Fn::ImportValue':
                  'TestPhotosPageStack:ExportsOutputFnGetAttDeleteMediaLambdaLambdaNodeFunctionE0132D0CArn6E514775',
              },
              '/invocations',
            ],
          ],
        },
      },
    });
  });
});
