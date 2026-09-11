module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/tests/**/*.test.ts'],
};
