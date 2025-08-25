/**
 * Parses a comma-separated string of numbers into a clean array of numbers.
 *
 * - Trims whitespace around each element.
 * - Ignores empty entries caused by consecutive commas or leading/trailing commas.
 * - Converts valid numeric substrings into numbers.
 * - Filters out any values that cannot be parsed into a number (NaN).
 *
 * @param input - Optional CSV string (e.g. "1, 2, 3"). If undefined or empty, returns undefined.
 * @returns An array of parsed numbers, or undefined if no input was provided.
 */
export function parseCsvNumbers(input?: string): number[] | undefined {
  if (!input) return undefined;
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}
