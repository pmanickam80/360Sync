const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const ALLOWED_DOMAIN = 'servify.com';

const oauth2Client = new OAuth2Client(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authService = {
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      hd: ALLOWED_DOMAIN // Restrict to servify.com domain
    });
  },

  async handleCallback(code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      });

      const userInfo = await response.json();

      // Verify domain
      if (!userInfo.email || !userInfo.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        throw new Error(`Access denied. Only ${ALLOWED_DOMAIN} users are allowed.`);
      }

      return {
        tokens,
        user: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        }
      };
    } catch (error) {
      console.error('Auth callback error:', error);
      throw error;
    }
  },

  // Middleware to check authentication
  requireAuth(req, res, next) {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        authUrl: authService.getAuthUrl()
      });
    }

    // Verify domain
    if (!user.email || !user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(403).json({
        error: 'Access denied. Only servify.com users are allowed.'
      });
    }

    req.user = user;
    next();
  },

  // Check if authentication is configured
  isConfigured() {
    return !!(CLIENT_ID && CLIENT_SECRET);
  }
};

module.exports = { authService };