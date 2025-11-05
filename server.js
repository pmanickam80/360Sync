require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { Firestore } = require('@google-cloud/firestore');
const FirestoreStore = require('firestore-store')(session);
const { authService } = require('./services/auth');
const emailService = require('./services/emailService');
const { firestoreService } = require('./services/firestore');
const { analyticsMiddleware, getRequestMetadata } = require('./services/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Cloud Run is behind Google's load balancer
app.set('trust proxy', 1);

// Initialize Firestore for session storage
const firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'servifyportal',
});

// Middleware
// Configure CORS properly for production to allow credentials
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? 'https://sync360-dashboard-815407754077.us-central1.run.app'
        : true,
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Session configuration with Firestore store (for Cloud Run)
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
};

// Use Firestore for session storage in production
if (process.env.NODE_ENV === 'production') {
    sessionConfig.store = new FirestoreStore({
        database: firestore
    });
}

app.use(session(sessionConfig));

// Auth routes
app.get('/auth/google', (req, res) => {
    const authUrl = authService.getAuthUrl();
    res.json({ authUrl });
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        const { user } = await authService.handleCallback(code);

        // Store user in session
        req.session.user = user;

        // Track user login with metadata
        if (firestoreService.isAvailable()) {
            const metadata = getRequestMetadata(req);
            firestoreService.trackUserLogin({
                ...user,
                ...metadata
            }).catch(err => console.error('Error tracking login:', err));
        }

        // Redirect to dashboard
        res.redirect('/');
    } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/?error=auth_failed');
    }
});

app.post('/auth/logout', (req, res) => {
    const userEmail = req.session?.user?.email;

    // Track user logout
    if (userEmail && firestoreService.isAvailable()) {
        firestoreService.trackUserLogout(userEmail)
            .catch(err => console.error('Error tracking logout:', err));
    }

    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: !!req.session?.user,
        user: req.session?.user || null
    });
});

// Serve static files
app.use(express.static('public'));

// Protected routes - require authentication
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Advance Exchange Dashboard is running',
        timestamp: new Date().toISOString(),
        authConfigured: authService.isConfigured()
    });
});

// Admin/Analytics API endpoints
app.get('/api/admin/users', async (req, res) => {
    try {
        if (!firestoreService.isAvailable()) {
            return res.json({
                success: false,
                error: 'Analytics not available in development mode'
            });
        }

        const stats = await firestoreService.getUserStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/activity', async (req, res) => {
    try {
        if (!firestoreService.isAvailable()) {
            return res.json({
                success: false,
                error: 'Analytics not available in development mode'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const activity = await firestoreService.getRecentActivity(limit);
        res.json({ success: true, data: activity });
    } catch (error) {
        console.error('Error getting recent activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/reports', async (req, res) => {
    try {
        if (!firestoreService.isAvailable()) {
            return res.json({
                success: false,
                error: 'Analytics not available in development mode'
            });
        }

        const days = parseInt(req.query.days) || 30;
        const stats = await firestoreService.getReportStats(days);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error getting report stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/status', (req, res) => {
    res.json({
        success: true,
        data: {
            firestoreAvailable: firestoreService.isAvailable(),
            authConfigured: authService.isConfigured(),
            emailConfigured: !!(process.env.GMAIL_USERNAME && process.env.GMAIL_APP_PASSWORD),
            environment: process.env.NODE_ENV || 'development',
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'servifyportal'
        }
    });
});

// Email notification endpoint
app.post('/api/notify/preprocessing',
    analyticsMiddleware('send_notification', (req) => ({
        claimsCount: Object.values(req.body.claimsData || {}).reduce((sum, claims) => sum + claims.length, 0),
        programs: Object.keys(req.body.claimsData || {}).length
    })),
    async (req, res) => {
    try {
        const { claimsData, recipients } = req.body;

        if (!claimsData || typeof claimsData !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid claims data provided'
            });
        }

        // Use provided recipients or fall back to environment variable
        const emailRecipients = recipients || process.env.NOTIFICATION_TO_EMAILS;

        if (!emailRecipients) {
            return res.status(400).json({
                success: false,
                error: 'No email recipients configured'
            });
        }

        console.log('Sending pre-processing notification to:', emailRecipients);
        console.log('Claims data:', Object.keys(claimsData).map(program => `${program}: ${claimsData[program].length}`));

        const result = await emailService.sendPreProcessingNotification(claimsData, emailRecipients);

        res.json({
            success: true,
            message: 'Notification sent successfully',
            messageId: result.messageId
        });

    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send notification'
        });
    }
});

// Get notification configuration
app.get('/api/notify/config', (req, res) => {
    res.json({
        fromEmail: process.env.NOTIFICATION_FROM_EMAIL,
        defaultRecipients: process.env.NOTIFICATION_TO_EMAILS,
        smtpConfigured: !!(process.env.GMAIL_USERNAME && process.env.GMAIL_APP_PASSWORD)
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  🚀 Advance Exchange Dashboard');
    console.log('='.repeat(60));
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
    console.log('\n  Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n\n🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n\n🛑 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});
