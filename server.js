require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { authService } = require('./services/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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

        // Redirect to dashboard
        res.redirect('/');
    } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/?error=auth_failed');
    }
});

app.post('/auth/logout', (req, res) => {
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
