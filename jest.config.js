module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/lambda/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverage: true,
  coverageDirectory: 'build/coverage',
  coverageReporters: ['text', 'html'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'lambda/**/*.ts',
    '!**/node_modules/**',
    '!**/build/**',
    '!**/cdk.out/**',
    '!**/vendor/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
