import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';

interface DynamoDbTableProps {
  /**
   * The name of the DynamoDB table.
   */
  tableName: string;
  /**
   * The partition key for the table, which uniquely identifies each item.
   */
  partitionKey: { name: string; type: AttributeType };
  /**
   * Specifies the removal policy for the table, determining whether
   * the table is retained or deleted when the stack is destroyed.
   */
  removalPolicy: RemovalPolicy;
  /**
   * The billing mode for the table either per request or
   * with specified Read/Write capacity units.
   */
  billingMode: BillingMode;
  /**
   * An optional sort key for the table, allowing range queries.
   */
  sortKey?: { name: string; type: AttributeType };
  /**
   * An optional array of Global Secondary Indexes (GSIs) to define for the table.
   */
  gsis?: Array<{
    indexName: string;
    partitionKey: { name: string; type: AttributeType };
    sortKey?: { name: string; type: AttributeType };
    projectionType: ProjectionType;
    includeAttributes?: string[];
  }>;
}

/**
 * DynamoDbTable is a construct that creates a DynamoDB table with optional Global Secondary Indexes (GSIs).
 */
export class DynamoDbTable extends Construct {
  /**
   * The DynamoDB table created by this construct.
   */
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: DynamoDbTableProps) {
    super(scope, id);

    this.table = new Table(this, 'DynamoDbTable', {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      sortKey: props.sortKey,
      billingMode: props.billingMode,
      removalPolicy: props.removalPolicy,
    });

    props.gsis?.forEach((gsi) => {
      this.table.addGlobalSecondaryIndex({
        indexName: gsi.indexName,
        partitionKey: gsi.partitionKey,
        sortKey: gsi.sortKey,
        projectionType: gsi.projectionType,
        nonKeyAttributes:
          gsi.projectionType === ProjectionType.INCLUDE
            ? gsi.includeAttributes
            : undefined,
      });
    });
  }
}
