import { LookupType } from './types';

/**
 * Metadata describing a lookup table in the database.
 *
 * @property table - The name of the database table.
 * @property idColumn - The name of the table's primary key column.
 */
export type LookupMetadata = { table: string; idColumn: string };

/**
 * A mapping from each valid `LookupType` to its corresponding table metadata.
 *
 * Used to dynamically generate SQL queries for different types of lookup values,
 * such as cuisines, genres, or dishes.
 */
const LOOKUP_SQL_MAP: Record<LookupType, LookupMetadata> = {
  cuisine: { table: 'cuisine', idColumn: 'cuisine_id' },
  media_genre: { table: 'media_genre', idColumn: 'media_genre_id' },
  dish: { table: 'dish', idColumn: 'dish_id' },
  experience_genre: {
    table: 'experience_genre',
    idColumn: 'experience_genre_id',
  },
};

/**
 * Retrieves the table metadata associated with a given `LookupType`.
 *
 * Throws an error if the provided lookup type is not supported.
 *
 * @param lookupType - The type of lookup (e.g., 'cuisine', 'media_genre').
 * @returns The `LookupMetadata` containing the table name and primary key column.
 * @throws {Error} If the lookup type is not defined in `LOOKUP_SQL_MAP`.
 */
export function getLookupMetadata(lookupType: LookupType): LookupMetadata {
  const lookup = LOOKUP_SQL_MAP[lookupType];
  if (!lookup) {
    throw new Error(`Invalid lookupType: ${lookupType}`);
  }
  return lookup;
}
