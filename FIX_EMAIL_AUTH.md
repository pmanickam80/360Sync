# Fix Gmail Authentication Issue

## Problem
Gmail is rejecting the app password with error:
```
535-5.7.8 Username and Password not accepted
```

## Root Cause
The app password in `.env` might be:
1. **Expired** - App passwords can expire
2. **Invalid** - Wrong password was saved
3. **Google Workspace settings** - Your organization (servify.com) may have different security settings

## Solution: Create New Gmail App Password

### Step 1: Enable 2-Step Verification
1. Go to: https://myaccount.google.com/security
2. Find "2-Step Verification"
3. Make sure it's **turned ON**

### Step 2: Create App Password
1. Go to: https://myaccount.google.com/apppasswords
   - **Alternative**: Google Account → Security → 2-Step Verification → App passwords
2. Click "Select app" → Choose "Mail"
3. Click "Select device" → Choose "Other (Custom name)"
4. Type: `360Sync Dashboard`
5. Click "Generate"
6. **Copy the 16-character password** (looks like: `xxxx xxxx xxxx xxxx`)

### Step 3: Update .env File
1. Open `/Users/prakash/Downloads/360Sync/.env`
2. Find the line:
   ```env
   GMAIL_APP_PASSWORD=fhyfriycxqysekul
   ```
3. Replace with your NEW app password (remove spaces):
   ```env
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   ```
4. Save the file

### Step 4: Restart Server
```bash
# In terminal, stop the server
Ctrl+C

# Restart
npm start
```

### Step 5: Test Email
1. Refresh dashboard (Cmd+Shift+R)
2. Go to Live Monitor → Pre-Processing tab
3. Click "📧 Notify Team"
4. Should see "✅ Sent!" instead of error

## Alternative: Check Google Workspace Settings

If you're using Google Workspace (servify.com domain), your IT admin might have:
- Disabled app passwords
- Required OAuth2 authentication
- Blocked "less secure app access"

### Contact IT Admin
Ask them to:
1. Enable app passwords for your account
2. Or provide OAuth2 credentials
3. Or whitelist the SMTP service

## Alternative Solution: Use Different Email Service

If Gmail continues to fail, you can use alternative SMTP services:

### Option 1: Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
GMAIL_USERNAME=prakash.m@servify.com
GMAIL_APP_PASSWORD=your_password_here
```

### Option 2: SendGrid (Free tier: 100 emails/day)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
GMAIL_USERNAME=apikey
GMAIL_APP_PASSWORD=your_sendgrid_api_key
```

### Option 3: AWS SES (Pay as you go)
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
GMAIL_USERNAME=your_aws_access_key
GMAIL_APP_PASSWORD=your_aws_secret_key
```

## Test Email Connection

Run this command to test the connection:
```bash
node -e "
const emailService = require('./services/emailService');
emailService.testConnection().then(result => {
  console.log('Test result:', result);
  process.exit(result ? 0 : 1);
});
"
```

Expected output if working:
```
✅ Email service is ready to send emails
Test result: true
```

## Still Having Issues?

### Debug Mode
Check server console logs when clicking "Notify Team":
- Look for "Sending pre-processing notification to: ..."
- Check for detailed error messages
- Verify credentials are being loaded

### Common Errors

**Error: "getaddrinfo ENOTFOUND smtp.gmail.com"**
- Solution: Check internet connection

**Error: "Connection timeout"**
- Solution: Check firewall/proxy settings
- Try port 465 with `secure: true`

**Error: "Too many login attempts"**
- Solution: Wait 15 minutes and try again
- Gmail may have temporarily blocked your account

## Need Immediate Workaround?

For now, you can **disable email notifications** and use the dashboard export feature:
1. Click "Export" button (when we add it)
2. Or manually copy claim data from the table
3. Send via regular email

Let me know which solution you'd like to pursue!
