/**
 * Encodes a JavaScript object into a Base64 string.
 * 
 * @param obj - The JavaScript object to encode.
 * @returns A Base64-encoded string representation of the input object.
 */
export function encode(obj: object): string {
  const stringifiedObj = JSON.stringify(obj);
  return Buffer.from(stringifiedObj).toString('base64');
}

/**
 * Decodes a Base64 string back into a JavaScript object.
 * 
 * @param str - A Base64-encoded string representing a serialized JavaScript object.
 * @returns The decoded JavaScript object.
 */
export function decode(str: string): object {
  return JSON.parse(Buffer.from(str, 'base64').toString());
}
