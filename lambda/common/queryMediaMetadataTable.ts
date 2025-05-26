import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Queries the MediaMetadata DynamoDB table to retrieve media metadata for a given stack ID.
 *
 * @param stackId - The stack ID for which media metadata is being queried.
 * @returns A Promise that resolves to the query result containing the media metadata.
 */
export async function queryMediaMetadataTable(
  dynamoDbClient: DynamoDBDocumentClient,
  stackId: string,
  mediaMetadataTable: string,
  mediaMetadataGsi: string,
) {
  const params = {
    TableName: mediaMetadataTable,
    IndexName: mediaMetadataGsi,
    KeyConditionExpression: 'stackId = :stackId',
    ExpressionAttributeValues: {
      ':stackId': stackId,
    },
  };
  const command = new QueryCommand(params);
  return await dynamoDbClient.send(command);
}
