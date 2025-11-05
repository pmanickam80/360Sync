# 360Sync Dashboard - Google Cloud Deployment Guide

This guide will help you deploy the 360Sync Dashboard to Google Cloud Run with full tracking, monitoring, and analytics capabilities.

## 🎯 Features

### Core Features
- **User Authentication**: Google OAuth with servify.com domain restriction
- **Report Processing**: Upload and analyze Advance Exchange and Sales Order reports
- **Chrome Extension**: Auto-fetch claim details from 360 portal
- **Email Notifications**: Send HTML email notifications to team
- **SLA Monitoring**: Track and monitor SLA compliance

### Cloud Features (Production)
- **User Tracking**: Track all user logins, logouts, and actions
- **Activity Monitoring**: Monitor all user activity in real-time
- **Report Analytics**: Track report processing statistics
- **Admin Dashboard**: View users, activity, and system statistics at `/admin.html`
- **Firestore Integration**: Store all tracking data in Firestore
- **Cloud Logging**: Centralized logging with Google Cloud Logging
- **Secret Manager**: Secure storage of sensitive credentials

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Project**: `servifyportal` (Project ID: 815407754077)
3. **gcloud CLI**: Already installed and configured
4. **Permissions**: Owner or Editor role on the project

## 🚀 Deployment Steps

### Step 1: Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `@google-cloud/firestore` - User and activity tracking
- `@google-cloud/logging` - Cloud logging
- `@google-cloud/secret-manager` - Secure credential storage

### Step 2: Update .env for Production

Edit `.env` and ensure you have:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Session Secret (generate a strong random string)
SESSION_SECRET=your-strong-random-secret-key

# Gmail Credentials
GMAIL_USERNAME=your-email@servify.com
GMAIL_APP_PASSWORD=your-app-password

# Email Notification Settings
NOTIFICATION_FROM_EMAIL=your-email@servify.com
NOTIFICATION_TO_EMAILS=team@servify.com,admin@servify.com

# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**Important**: Update `GOOGLE_REDIRECT_URI` to your production URL after deployment.

### Step 3: Setup Secret Manager

Store all sensitive credentials in Secret Manager:

```bash
./setup-secrets.sh
```

This script will:
- Enable Secret Manager API
- Create secrets from your .env file
- Grant Cloud Run service account access to secrets

### Step 4: Deploy to Cloud Run

```bash
./deploy.sh
```

This script will:
1. Enable required Google Cloud APIs:
   - Cloud Build API
   - Cloud Run API
   - Artifact Registry API
   - Secret Manager API
   - Firestore API
   - Cloud Logging API

2. Create Artifact Registry repository for Docker images

3. Build the Docker container using Cloud Build

4. Deploy to Cloud Run with:
   - 512MB memory, 1 CPU
   - Auto-scaling: 0-10 instances
   - 300s timeout
   - Secrets mounted as environment variables
   - Firestore and logging enabled

5. Output the service URL

### Step 5: Update OAuth Redirect URI

After deployment, you'll get a URL like:
```
https://360sync-dashboard-xxx-uc.a.run.app
```

Update your Google OAuth credentials:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add the redirect URI:
   ```
   https://360sync-dashboard-xxx-uc.a.run.app/auth/google/callback
   ```
4. Save

Then update the secret:
```bash
echo "https://360sync-dashboard-xxx-uc.a.run.app/auth/google/callback" | \
  gcloud secrets versions add google-redirect-uri --data-file=-
```

### Step 6: Verify Deployment

1. **Visit the dashboard**: Open the URL from Step 4
2. **Test authentication**: Click "Sign in with Google"
3. **Check admin panel**: Visit `/admin.html` to see tracking
4. **Test report upload**: Upload and process reports
5. **Check Firestore**: Visit Firestore console to see tracked data

## 📊 Monitoring & Analytics

### Admin Dashboard

Access the admin dashboard at: `https://your-domain.com/admin.html`

Features:
- **System Status**: Environment, Firestore, Auth, Email status
- **User Statistics**: Total users, active users, activity count
- **User List**: All registered users with last login and activity
- **Recent Activity**: Live feed of user actions
- **Report Statistics**: Reports processed by type and user

### View Logs

```bash
# View all logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=360sync-dashboard" --limit 50

# Follow logs in real-time
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=360sync-dashboard"

# View errors only
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=360sync-dashboard AND severity>=ERROR" --limit 20
```

### Firestore Collections

The following collections are created in Firestore:

1. **users**: User profiles and last login
   ```
   {
     email: string,
     name: string,
     picture: string,
     lastLogin: timestamp,
     updatedAt: timestamp
   }
   ```

2. **user_activity**: All user actions
   ```
   {
     email: string,
     action: string,
     type: string,
     details: object,
     timestamp: timestamp
   }
   ```

3. **report_processing**: Report processing history
   ```
   {
     email: string,
     reportType: string,
     filename: string,
     rowCount: number,
     timestamp: timestamp,
     status: string,
     metadata: object
   }
   ```

## 🔧 Configuration

### Environment Variables (Production)

These are automatically set from Secret Manager:

- `NODE_ENV=production`
- `GOOGLE_CLOUD_PROJECT=servifyportal`
- `SESSION_SECRET` (from Secret Manager)
- `GOOGLE_CLIENT_ID` (from Secret Manager)
- `GOOGLE_CLIENT_SECRET` (from Secret Manager)
- `GMAIL_USERNAME` (from Secret Manager)
- `GMAIL_APP_PASSWORD` (from Secret Manager)
- `NOTIFICATION_FROM_EMAIL` (from Secret Manager)
- `NOTIFICATION_TO_EMAILS` (from Secret Manager)

### Update a Secret

```bash
# Update session secret
echo "new-secret-value" | gcloud secrets versions add session-secret --data-file=-

# Redeploy to pick up new secret
./deploy.sh
```

## 🌐 Custom Domain Setup (Optional)

### Step 1: Map Domain

```bash
gcloud run domain-mappings create \
  --service 360sync-dashboard \
  --region us-central1 \
  --domain dashboard.servify.com
```

### Step 2: Update DNS

Follow the instructions to add DNS records to your domain registrar.

### Step 3: SSL Certificate

SSL certificate is automatically provisioned by Google Cloud Run (may take 15-30 minutes).

## 🔒 Security

### Authentication
- Google OAuth 2.0 with domain restriction (@servify.com only)
- Session-based authentication with secure cookies
- Session timeout: 24 hours

### Secrets
- All sensitive data stored in Secret Manager
- Automatic secret rotation supported
- Service account with least privilege access

### Network
- HTTPS enforced by default
- Cloud Run IAM for service-to-service auth
- Firestore security rules (to be configured)

## 🛠️ Maintenance

### Update Application

```bash
# 1. Make code changes
# 2. Commit to git
git add .
git commit -m "Your changes"
git push

# 3. Deploy
./deploy.sh
```

### View Service Details

```bash
gcloud run services describe 360sync-dashboard --region us-central1
```

### Scale Configuration

```bash
# Update scaling
gcloud run services update 360sync-dashboard \
  --region us-central1 \
  --max-instances 20 \
  --min-instances 1
```

### Update Memory/CPU

```bash
gcloud run services update 360sync-dashboard \
  --region us-central1 \
  --memory 1Gi \
  --cpu 2
```

## 📈 Cost Estimation

Based on moderate usage (100 users, 10,000 requests/month):

- **Cloud Run**: ~$5-10/month (pay per request)
- **Firestore**: ~$1-5/month (small dataset)
- **Cloud Build**: Free tier covers most deployments
- **Cloud Logging**: Free tier covers most logs
- **Secret Manager**: ~$1/month

**Total**: Approximately $10-20/month

## 🐛 Troubleshooting

### "Authentication Failed"
- Check OAuth client ID and secret in Secret Manager
- Verify redirect URI matches deployment URL
- Check user email domain is @servify.com

### "Firestore Error"
- Ensure Firestore is initialized in the project
- Check service account has Firestore permissions
- Verify `GOOGLE_CLOUD_PROJECT` environment variable

### "Email Not Sending"
- Check Gmail credentials in Secret Manager
- Verify app password is correct (not regular password)
- Check SMTP settings in .env

### "Build Failed"
- Check Dockerfile syntax
- Verify all files are included (check .dockerignore)
- Review Cloud Build logs

### View Error Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 50
```

## 📞 Support

For issues or questions:
1. Check logs: `gcloud logging tail`
2. Check admin dashboard: `/admin.html`
3. Review Firestore data in console
4. Contact: prakash.m@servify.com

## ✅ Post-Deployment Checklist

- [ ] Application deployed successfully
- [ ] OAuth authentication working
- [ ] Secret Manager configured
- [ ] Firestore tracking enabled
- [ ] Email notifications working
- [ ] Chrome extension configured with new URL
- [ ] Admin dashboard accessible
- [ ] Custom domain mapped (optional)
- [ ] Team members can access the dashboard
- [ ] Monitoring and logs configured

## 🎉 Next Steps

1. **Share the URL** with your team
2. **Configure Chrome Extension**: Update `EXTENSION_ID` in production
3. **Set up Monitoring Alerts**: Configure Cloud Monitoring alerts
4. **Firestore Security Rules**: Add proper security rules
5. **Backup Strategy**: Set up automated Firestore backups
6. **Performance Testing**: Test with production load

---

**Deployment Date**: November 5, 2025
**Version**: 1.0.0
**Cloud Project**: servifyportal (815407754077)
