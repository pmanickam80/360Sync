// Authentication Integration for Advance Exchange Dashboard

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.authenticated) {
            showAuthenticatedUI(data.user);
        } else {
            showLoginUI();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showLoginUI();
    }
}

// Show login UI
function showLoginUI() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div style="max-width: 500px; margin: 100px auto; text-align: center;">
            <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 60px; height: 60px; color: #667eea; margin: 0 auto 20px;">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <h2 style="margin-bottom: 15px; color: #1f2937;">Sign In Required</h2>
                <p style="color: #6b7280; margin-bottom: 30px;">
                    Please sign in with your Servify Google account to access the Advance Exchange Dashboard
                </p>
                <button onclick="handleLogin()" class="primary-button" style="margin: 0 auto;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                    Sign in with Google
                </button>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
                    Only @servify.com email addresses are allowed
                </p>
            </div>
        </div>
    `;

    // Hide sidebar when not authenticated
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
}

// Show authenticated UI
function showAuthenticatedUI(user) {
    // Show sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'block';

    // Update header with user info
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && user) {
        const userName = user.name || user.email;
        headerActions.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot"></span>
                ` + userName + `
            </span>
            <span class="timestamp" id="currentTime"></span>
            <button onclick="handleLogout()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                Logout
            </button>
        `;
    }
}

// Handle login
async function handleLogin() {
    try {
        const response = await fetch('/auth/google');
        const data = await response.json();

        // Redirect to Google OAuth
        window.location.href = data.authUrl;
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to initiate login. Please try again.');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
}

// Check auth on page load
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to let other scripts load
    setTimeout(checkAuth, 100);
});
