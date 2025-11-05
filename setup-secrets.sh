#!/bin/bash

# Setup Google Cloud Secret Manager for 360Sync Dashboard

set -e

PROJECT_ID="servifyportal"

echo "================================="
echo "  Secret Manager Setup for 360Sync"
echo "================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with your configuration"
    exit 1
fi

# Set the project
echo "📦 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable Secret Manager API
echo "🔧 Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2

    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name (empty value)"
        return
    fi

    echo "🔐 Creating/updating secret: $secret_name"

    # Check if secret exists
    if gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
        # Update existing secret
        echo "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    else
        # Create new secret
        echo "$secret_value" | gcloud secrets create $secret_name --data-file=- --replication-policy="automatic"
    fi
}

# Load values from .env
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

# Create/update secrets
echo ""
echo "Creating secrets from .env file..."
echo ""

create_or_update_secret "session-secret" "$SESSION_SECRET"
create_or_update_secret "google-client-id" "$GOOGLE_CLIENT_ID"
create_or_update_secret "google-client-secret" "$GOOGLE_CLIENT_SECRET"
create_or_update_secret "gmail-username" "$GMAIL_USERNAME"
create_or_update_secret "gmail-app-password" "$GMAIL_APP_PASSWORD"
create_or_update_secret "notification-from-email" "$NOTIFICATION_FROM_EMAIL"
create_or_update_secret "notification-to-emails" "$NOTIFICATION_TO_EMAILS"

# Grant Cloud Run service account access to secrets
echo ""
echo "🔑 Granting Cloud Run access to secrets..."

SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"

for secret in "session-secret" "google-client-id" "google-client-secret" "gmail-username" "gmail-app-password" "notification-from-email" "notification-to-emails"; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID \
        2>/dev/null || true
done

echo ""
echo "✅ Secret Manager setup complete!"
echo ""
echo "📝 Secrets created:"
gcloud secrets list --project=$PROJECT_ID
echo ""
echo "Next steps:"
echo "1. Run ./deploy.sh to deploy the application"
echo "2. The secrets will be automatically mounted as environment variables"
echo ""
