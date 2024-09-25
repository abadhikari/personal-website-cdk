import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';

interface DynamoDbTableProps {
  tableName: string;
  partitionKey: { name: string; type: AttributeType };
  removalPolicy: RemovalPolicy;
  billingMode: BillingMode;
  sortKey?: { name: string; type: AttributeType };
  gsis?: Array<{
    indexName: string;
    partitionKey: { name: string; type: AttributeType };
    sortKey?: { name: string; type: AttributeType };
    projectionType: ProjectionType;
    includeAttributes?: string[];
  }>;
}

export class DynamoDbTable extends Construct {
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
