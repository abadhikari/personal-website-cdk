import { StackProps, Stack, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '../constructs/api-gateway-rest-api';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
import { Vpc } from '../constructs/vpc';
import { SecretsManager } from '../constructs/secrets-manager';
import { Rds } from '../constructs/rds';
import { DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';

export interface ReviewsPageStackProps extends StackProps {}

/**
 * ReviewsPageStack sets up the backend infrastructure for the reviews page
 * of abhinnaadhikari.com.
 *
 * Resources include:
 * - A VPC to host resources
 * - Secrets Manager to store database credentials
 * - An RDS instance for storing review data
 * - API Gateway for handling HTTP requests related to reviews
 */
export class ReviewsPageStack extends Stack {
  /**
   * The API Gateway REST API used for handling reviews-related HTTP requests on the reviews page.
   */
  private readonly reviewsApi: ApiGatewayRestApi;

  /**
   * The VPC (Virtual Private Cloud) in which the rds instance resides.
   */
  private readonly reviewsVpc: Vpc;

  /**
   * The secret in Secrets Manager for securely storing database credentials.
   */
  private readonly rdsCredentialsSecret: SecretsManager;

  /**
   * The RDS instance for storing review data.
   */
  private readonly reviewsDbInstance: Rds;

  constructor(scope: Construct, id: string, props: ReviewsPageStackProps) {
    super(scope, id, props);

    // VPC
    this.reviewsVpc = new Vpc(this, 'ReviewsVpc', {
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // SecretsManager
    this.rdsCredentialsSecret = new SecretsManager(this, 'ReviewsSecret', {
      username: 'dbadmin',
      generateStringKey: 'password',
      passwordLength: 16,
      excludeCharacters: '/@" ',
    });

    // RDS
    this.reviewsDbInstance = new Rds(this, 'ReviewsDb', {
      engine: DatabaseInstanceEngine.POSTGRES,
      vpc: this.reviewsVpc.vpc,
      secret: this.rdsCredentialsSecret.secret,
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      multiAz: false,
      allocatedStorage: 20,
      databaseName: 'reviews_database',
      backupRetention: Duration.days(7),
      deletionProtection: true,
    });

    // API Gateway
    this.reviewsApi = new ApiGatewayRestApi(this, 'ReviewsApi', {
      restApiName: 'ReviewsApi',
      description: 'API for handling reviews on the reviews page',
      cors: {
        allowMethods: Cors.ALL_METHODS,
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
  }
}
