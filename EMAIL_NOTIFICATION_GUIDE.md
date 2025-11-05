# Email Notification Feature

## Overview
The Pre-Processing Claims notification feature sends beautifully formatted HTML emails to your team when claims require attention.

## Features

### 📧 What Gets Sent
- **Summary Statistics**: Total claims, programs, claim types breakdown
- **Claims by Program**: Organized tables showing:
  - Claim ID
  - Customer name
  - Claim Type (Theft & Loss, Regular AE, Same-Day Replacement)
  - CSR Status
  - Creation Date
  - Age (days since creation)

### 🎨 Email Design
- Professional gradient header
- Color-coded claim types:
  - Theft & Loss: Red/Pink
  - Regular AE: Blue
  - Same-Day Replacement: Purple
- Summary cards with statistics
- Mobile-responsive design
- Plain text fallback for email clients that don't support HTML

## Configuration

### Current Settings (in `.env`)
```env
# Email Notification Settings
NOTIFICATION_FROM_EMAIL=prakash.m@servify.com
NOTIFICATION_TO_EMAILS=prakash.m@servify.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Gmail Credentials (already configured)
GMAIL_USERNAME=prakash.m@servify.com
GMAIL_APP_PASSWORD=fhyfriycxqysekul
```

### Adding More Recipients
To add multiple recipients, edit `.env`:
```env
NOTIFICATION_TO_EMAILS=prakash.m@servify.com,john.doe@servify.com,jane.smith@servify.com
```

## How to Use

1. **Upload and Process Reports**
   - Go to Live Monitor
   - Upload 360 Advance Exchange Report and Sales Order Report
   - Process the reports

2. **Navigate to Pre-Processing Tab**
   - Click on "📋 Pre-Processing" tab
   - You'll see all claims not ready for shipment order creation

3. **Send Notification**
   - Click the green "📧 Notify Team" button in the top-right
   - Watch the button status:
     - `⏳ Sending...` - Email is being sent
     - `✅ Sent!` - Email sent successfully
     - `❌ Failed` - Error occurred
   - A confirmation dialog will show:
     - Recipients
     - Message ID

## API Endpoints

### Send Pre-Processing Notification
```http
POST /api/notify/preprocessing
Content-Type: application/json

{
  "claimsData": {
    "Samsung B2C": [
      {
        "claimId": "WYDYGAFHFZRR",
        "customer": "John Doe",
        "claimType": "Regular AE",
        "status360": "Payment Pending",
        "createdDate": "11/03/2025",
        "daysSinceCreated": 2
      }
    ]
  },
  "recipients": "optional@email.com"  // Optional, uses .env default if not provided
}
```

### Get Notification Configuration
```http
GET /api/notify/config

Response:
{
  "fromEmail": "prakash.m@servify.com",
  "defaultRecipients": "prakash.m@servify.com",
  "smtpConfigured": true
}
```

## Email Template Structure

### Subject Line
```
🚨 Pre-Processing Claims Alert: X claims requiring attention
```

### Body Sections
1. **Header**: Purple gradient with title
2. **Summary**: 4 cards showing totals
3. **Claims by Program**: Tables grouped by program
4. **Footer**: Timestamp and dashboard link

## Troubleshooting

### Email Not Sending?
1. **Check SMTP Credentials**
   ```bash
   # Verify .env has correct credentials
   cat .env | grep GMAIL
   ```

2. **Test Email Service**
   ```javascript
   // In Node.js console
   const emailService = require('./services/emailService');
   emailService.testConnection();
   ```

3. **Check Server Logs**
   - Look for errors in the terminal where server is running
   - Check for "Email sent successfully" message

### Common Issues

**"No email recipients configured"**
- Solution: Add `NOTIFICATION_TO_EMAILS` in `.env`

**"Authentication failed"**
- Solution: Verify Gmail App Password is correct
- Note: Regular Gmail password won't work, must use App Password

**"Failed to send notification"**
- Check server is running at http://localhost:3000
- Check network connection
- Check Gmail hasn't blocked the account

## Gmail App Password Setup
(If you need to create a new one)

1. Go to Google Account settings
2. Security → 2-Step Verification
3. App passwords
4. Generate new password for "Mail"
5. Copy the 16-character password
6. Add to `.env` as `GMAIL_APP_PASSWORD`

## Future Enhancements

- [ ] Schedule automatic daily/weekly notifications
- [ ] Add email templates for other tabs (Interface Failures, Exceptions)
- [ ] Add ability to customize recipient list from UI
- [ ] Add attachment with Excel export
- [ ] Add filters (date range, business unit) to notification
- [ ] Email delivery tracking and read receipts

## Files Modified

1. `.env` - Added email configuration
2. `services/emailService.js` - Email service with HTML template
3. `server.js` - API endpoints for notifications
4. `public/js/app.js` - UI button and notification function
5. `package.json` - Added nodemailer dependency

## Need Help?

Contact: prakash.m@servify.com
