module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['controllers/**/*.js', 'routes/**/*.js'],
};
