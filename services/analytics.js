const { firestoreService } = require('./firestore');

// Analytics middleware to track user actions
const analyticsMiddleware = (action, getDetails = null) => {
  return async (req, res, next) => {
    // Store original json and send methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override res.json to track after response
    res.json = function(data) {
      // Track the action if user is authenticated
      if (req.session?.user?.email && firestoreService.isAvailable()) {
        const details = getDetails ? getDetails(req, data) : {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode
        };

        // Track asynchronously, don't wait
        firestoreService.trackAction(
          req.session.user.email,
          action,
          details
        ).catch(err => console.error('Analytics tracking error:', err));
      }

      return originalJson(data);
    };

    // Override res.send to track after response
    res.send = function(data) {
      // Track the action if user is authenticated
      if (req.session?.user?.email && firestoreService.isAvailable()) {
        const details = getDetails ? getDetails(req, data) : {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode
        };

        // Track asynchronously, don't wait
        firestoreService.trackAction(
          req.session.user.email,
          action,
          details
        ).catch(err => console.error('Analytics tracking error:', err));
      }

      return originalSend(data);
    };

    next();
  };
};

// Helper to get request metadata
const getRequestMetadata = (req) => {
  return {
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    referer: req.get('referer') || null
  };
};

module.exports = {
  analyticsMiddleware,
  getRequestMetadata
};
