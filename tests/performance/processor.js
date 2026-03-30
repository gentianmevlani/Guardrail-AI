// Artillery processor for load testing
const crypto = require('crypto');

// Generate random test data
function generateRandomEmail() {
  const domains = ['example.com', 'test.org', 'demo.net'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const randomString = crypto.randomBytes(8).toString('hex');
  return `user-${randomString}@${domain}`;
}

function generateRandomPassword() {
  return crypto.randomBytes(12).toString('hex') + '!';
}

// Custom functions for Artillery
module.exports = {
  generateRandomEmail,
  generateRandomPassword,
  
  // Process request data before sending
  requestHeaders: function(requestParams, context, ee, next) {
    if (context.authToken) {
      requestParams.headers = requestParams.headers || {};
      requestParams.headers['Authorization'] = `Bearer ${context.authToken}`;
    }
    return next();
  },
  
  // Capture scan ID from response
  captureScanId: function(requestParams, response, context, ee, next) {
    if (response.statusCode === 202 && response.body) {
      const body = JSON.parse(response.body);
      if (body.scan && body.scan.id) {
        context.scanId = body.scan.id;
      }
    }
    return next();
  },
  
  // Log performance metrics
  logMetrics: function(requestParams, response, context, ee, next) {
    const responseTime = response.timings.phases.total;
    if (responseTime > 1000) {
      console.warn(`Slow response: ${requestParams.url} took ${responseTime}ms`);
    }
    return next();
  }
};
