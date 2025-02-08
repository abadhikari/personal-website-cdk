import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';

export interface VpcProps {
  /**
   * The number of availability zones.
   */
  readonly maxAzs: number;

  /**
   * The number of NAT Gateways. Each NAT Gateway will have a cost.
   * If you want private subnets to have internet access, at least one NAT Gateway is required.
   * Defaults to 0 (no NAT Gateways).
   */
  readonly natGateways?: number;

  /**
   * Describes the configuration for a subnet within a VPC.
   */
  readonly subnetConfiguration: Array<{
    /**
     * The size of the subnet in bits.
     */
    cidrMask: number;

    /**
     * A human-readable identifier for the subnet group.
     */
    name: string;

    /**
     * The type of subnet you wish to create.
     *
     * Common types:
     * - `SubnetType.PUBLIC`: Subnets that have a route to an Internet Gateway.
     * - `SubnetType.PRIVATE_WITH_EGRESS`: Private subnets with a route (via a NAT Gateway) for outbound internet access.
     * - `SubnetType.PRIVATE_ISOLATED`: Completely isolated subnets with no direct route to the internet.
     */
    subnetType: SubnetType;
  }>;
}

/**
 * Vpc is a construct that creates an Amazon Virtual Private Cloud (VPC) with custom settings.
 *
 * The VPC is configured to allow multiple Availability Zones (AZs) and provides
 * flexibility for deploying private and public resources securely.
 */
export class Vpc extends Construct {
  /**
   * The Vpc created by this construct.
   */
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: props.maxAzs,
      natGateways: props.natGateways || 0,
      subnetConfiguration: props.subnetConfiguration,
    });
  }
}
