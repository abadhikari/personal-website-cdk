import { sanitizeFileName } from "../../../media/generate-signed-urls/sanitizeFileName";

describe('sanitizeFileName', () => {
  test('should sanitize various file names correctly', () => {
    const testCases = [
      { input: 'testfile.jpg', expected: 'testfile.jpg' },
      { input: 'Test File.PNG', expected: 'test-file.png' },
      { input: 'my_file_name (1).JPG', expected: 'my-file-name-1.jpg' },
      { input: ' file__name__with  spaces  .png ', expected: 'file-name-with-spaces.png' },
      { input: 'file<>?.txt', expected: 'file.txt' },
      { input: 'Another File Name   123.jpeg', expected: 'another-file-name-123.jpeg' },
      { input: 'file-with-dash_and_underscore.JPG', expected: 'file-with-dash-and-underscore.jpg' },
      { input: '   leading and trailing    .png   ', expected: 'leading-and-trailing.png' },
      { input: 'multiple---dashes__and__underscores.jpg', expected: 'multiple-dashes-and-underscores.jpg' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = sanitizeFileName(input);
      expect(result).toBe(expected);
    });
  });
});
