module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverage: true,
  coverageDirectory: 'build/coverage',
  coverageReporters: ['text', 'html'],
  moduleNameMapper: {
    '^@lambda/(.*)$': '<rootDir>/lambda/$1',
    '^@test-helpers/(.*)$': '<rootDir>/test/test-helpers/$1',
  },
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
