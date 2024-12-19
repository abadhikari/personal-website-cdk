/**
 * Sanitizes a file name by normalizing its format for storage.
 *
 * @param {string} fileName - The original file name, including its extension.
 * @returns {string} - The sanitized file name.
 */
export function sanitizeFileName(fileName: string): string {
    const trimmedFileName = fileName.trim();

    // Extract file extension
    const extensionMatch = trimmedFileName.match(/\.[0-9a-z]+$/i);
    const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '';
  
    // Sanitize the base name (everything before the extension)
    const baseName = trimmedFileName
      .replace(/\.[0-9a-z]+$/i, '') // Remove extension temporarily
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '-') // Replace spaces (including multiple spaces) and underscores with hyphens
      .replace(/[^a-z0-9.-]/g, ''); // Remove invalid characters, keeping letters, numbers, dots, and hyphens
  
    // Combine sanitized base name and extension
    return `${baseName}${extension}`;
}