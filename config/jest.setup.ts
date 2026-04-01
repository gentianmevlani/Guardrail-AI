// Global test setup

// Set test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-minimum-32-characters-long";
process.env.DATABASE_URL = "file:./test.db";

// Global test timeout for integration tests
jest.setTimeout(30000);

// Global test helpers
const integrationHelpers = {
  authenticatedRequest: function (token) {
    return { headers: { Authorization: "Bearer " + token } };
  },
  waitForServer: function (ms) {
    ms = ms || 100;
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  },
};

global.integrationHelpers = integrationHelpers;
