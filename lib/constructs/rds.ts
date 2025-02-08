import { Construct } from 'constructs';
import {
  Credentials,
  DatabaseInstance,
  IInstanceEngine,
} from 'aws-cdk-lib/aws-rds';
import { InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Duration } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export interface RdsProps {
  /**
   * The engine for the RDS instance.
   * This defines the database engine to use (e.g., PostgreSQL, MySQL, etc.).
   */
  readonly engine: IInstanceEngine;

  /**
   * The VPC where the RDS instance will be placed.
   * The RDS instance will reside in this VPC, making it part of your isolated network infrastructure.
   */
  readonly vpc: Vpc;

  /**
   * The secret containing the RDS credentials (username and password).
   * The credentials are fetched from this secret for authentication to the RDS instance.
   */
  readonly secret: Secret;

  /**
   * The instance type for the RDS instance.
   * Defines the compute capacity and size for the RDS instance.
   */
  readonly instanceType: InstanceType;

  /**
   * Whether to enable multi-AZ deployments for high availability.
   * Enabling multi-AZ ensures that the RDS instance has a standby instance in a different availability zone for failover.
   * This is only really useful if there's multiple rds instances.
   */
  readonly multiAz: boolean;

  /**
   * The allocated storage for the RDS instance.
   * Defines how much storage the database should have. For example, 20GB for a small database or more for larger datasets.
   */
  readonly allocatedStorage: number;

  /**
   * The name of the database to be created in the RDS instance.
   * This is the initial database that will be created when the RDS instance is launched.
   */
  readonly databaseName: string;

  /**
   * The backup retention period for the RDS instance.
   * Defines how long automated backups are retained. A typical value is 7 days, but you can adjust it as needed.
   */
  readonly backupRetention: Duration;

  /**
   * Whether to enable deletion protection for the RDS instance.
   * If true, it prevents the RDS instance from being deleted accidentally.
   * You should enable this for production databases to avoid accidental deletion.
   */
  readonly deletionProtection: boolean;
}

/**
 * Rds is a construct that creates a new RDS (Relational Database Service) database instance in the given VPC.
 */
export class Rds extends Construct {
  public readonly instance: DatabaseInstance;

  constructor(scope: Construct, id: string, props: RdsProps) {
    super(scope, id);

    this.instance = new DatabaseInstance(this, 'Rds', {
      engine: props.engine,
      vpc: props.vpc,
      credentials: Credentials.fromSecret(props.secret),
      instanceType: props.instanceType,
      multiAz: props.multiAz,
      allocatedStorage: props.allocatedStorage,
      databaseName: props.databaseName,
      backupRetention: props.backupRetention,
      deletionProtection: props.deletionProtection,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
    });
  }
}
