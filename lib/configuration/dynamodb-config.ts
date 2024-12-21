export const PhotosPageDynamoDbTables = {
  STACK_METADATA_TABLE: 'StackMetadataTable',
  STACK_METADATA_GSI: 'UploadTimestampIndex',
  MEDIA_METADATA_TABLE: 'MediaMetadataTable',
  MEDIA_METADATA_GSI: 'StackIdIndex',
  STACK_METADATA_GSI_PARTITION_KEY: 'ALL_STACKS',
};
