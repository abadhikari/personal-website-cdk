import { StackProps, Stack, Duration } from 'aws-cdk-lib';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  InterfaceVpcEndpointAwsService,
  Port,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

import { ORIGIN_ALLOWLIST } from '../configuration/website-config';
import { LambdaNodeFunction } from '../constructs/lambda-node-function';
import { Rds } from '../constructs/rds';
import { SecretsManager } from '../constructs/secrets-manager';
import { Vpc } from '../constructs/vpc';

/**
 * ReviewsPageStack sets up the backend infrastructure for the reviews page
 * of abhinnaadhikari.com.
 *
 * Resources include:
 * - A VPC to host resources
 * - Secrets Manager to store database credentials
 * - An RDS instance for storing review data
 * - Admin Lambda to make admin queries to the database.
 */
export class ReviewsPageStack extends Stack {
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

  /**
   * The Lambda function responsible for sending queries to database.
   */
  private readonly databaseAdminQueryLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for writing content to database.
   */
  public readonly writeContentLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for reading contents from database.
   */
  public readonly readContentsLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for writing a review to database.
   */
  public readonly writeReviewLambda: LambdaNodeFunction;

  /**
   * The Lambda function responsible for reading reviews from database.
   */
  public readonly readReviewsLambda: LambdaNodeFunction;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // VPC
    this.reviewsVpc = new Vpc(this, 'ReviewsVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.reviewsVpc.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    const lambdaToRdsSecurityGroup = new SecurityGroup(this, 'LambdaToRdsSG', {
      vpc: this.reviewsVpc.vpc,
      description: 'Security group for Lambdas accessing the reviews RDS',
      allowAllOutbound: true,
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

    this.reviewsDbInstance.instance.connections.allowFrom(
      lambdaToRdsSecurityGroup,
      Port.tcp(5432),
      'Allow all review Lambdas to connect to RDS',
    );

    // Lambda
    const serializedOriginAllowList = ORIGIN_ALLOWLIST.join(',');

    this.databaseAdminQueryLambda = new LambdaNodeFunction(
      this,
      'DatabaseAdminQueryLambda',
      {
        functionName: 'reviews_page_database_admin_query_v1',
        description:
          'Internal admin query Lambda for manual RDS inspection and alterations',
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/admin/query/index.ts',
        handler: 'handler',
        securityGroups: [lambdaToRdsSecurityGroup],
        vpc: this.reviewsVpc.vpc,
        environment: {
          DB_SECRET_ARN: this.rdsCredentialsSecret.secret.secretArn,
        },
      },
    );

    this.grantLambdaDbAccess(this.databaseAdminQueryLambda);

    this.writeContentLambda = new LambdaNodeFunction(
      this,
      'WriteContentLambda',
      {
        functionName: 'reviews_page_write_content_v1',
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/content/write/index.ts',
        handler: 'handler',
        securityGroups: [lambdaToRdsSecurityGroup],
        vpc: this.reviewsVpc.vpc,
        environment: {
          DB_SECRET_ARN: this.rdsCredentialsSecret.secret.secretArn,
          ORIGIN_ALLOWLIST: serializedOriginAllowList,
        },
      },
    );

    this.grantLambdaDbAccess(this.writeContentLambda);

    this.readContentsLambda = new LambdaNodeFunction(
      this,
      'ReadContentsLambda',
      {
        functionName: 'reviews_page_read_contents_v1',
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/contents/read/index.ts',
        handler: 'handler',
        securityGroups: [lambdaToRdsSecurityGroup],
        vpc: this.reviewsVpc.vpc,
        environment: {
          DB_SECRET_ARN: this.rdsCredentialsSecret.secret.secretArn,
          ORIGIN_ALLOWLIST: serializedOriginAllowList,
        },
      },
    );

    this.grantLambdaDbAccess(this.readContentsLambda);

    this.writeReviewLambda = new LambdaNodeFunction(this, 'WriteReviewLambda', {
      functionName: 'reviews_page_write_review_v1',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/review/write/index.ts',
      handler: 'handler',
      securityGroups: [lambdaToRdsSecurityGroup],
      vpc: this.reviewsVpc.vpc,
      environment: {
        DB_SECRET_ARN: this.rdsCredentialsSecret.secret.secretArn,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    this.grantLambdaDbAccess(this.writeReviewLambda);

    this.readReviewsLambda = new LambdaNodeFunction(this, 'ReadReviewsLambda', {
      functionName: 'reviews_page_read_reviews_v1',
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/reviews/read/index.ts',
      handler: 'handler',
      securityGroups: [lambdaToRdsSecurityGroup],
      vpc: this.reviewsVpc.vpc,
      environment: {
        DB_SECRET_ARN: this.rdsCredentialsSecret.secret.secretArn,
        ORIGIN_ALLOWLIST: serializedOriginAllowList,
      },
    });

    this.grantLambdaDbAccess(this.readReviewsLambda);
  }

  /**
   * Grants the given Lambda function permission to:
   * - Connect to the reviews RDS instance
   * - Read the database credentials from Secrets Manager
   *
   * This method ensures the Lambda can securely authenticate and
   * communicate with the database.
   *
   * @param lambda - The LambdaNodeFunction instance requiring DB access
   */
  private grantLambdaDbAccess(lambda: LambdaNodeFunction) {
    this.reviewsDbInstance.instance.grantConnect(lambda.function);
    this.rdsCredentialsSecret.secret.grantRead(lambda.function);
  }
}
