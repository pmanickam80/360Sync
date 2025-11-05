#!/bin/bash

# 360Sync Deployment Script for Google Cloud Run

set -e

PROJECT_ID="servifyportal"
REGION="us-central1"
SERVICE_NAME="sync360-dashboard"
REPOSITORY="sync360"

echo "================================="
echo "  360Sync Deployment to Cloud Run"
echo "================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    exit 1
fi

# Set the project
echo "📦 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    logging.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPOSITORY \
    --repository-format=docker \
    --location=$REGION \
    --description="360Sync Dashboard Docker images" \
    2>/dev/null || echo "Repository already exists"

# Build the image using Cloud Build
echo "🏗️  Building container image..."
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID \
    --set-secrets SESSION_SECRET=session-secret:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,GMAIL_USERNAME=gmail-username:latest,GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest,NOTIFICATION_FROM_EMAIL=notification-from-email:latest,NOTIFICATION_TO_EMAILS=notification-to-emails:latest \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --timeout 300s

# Get the service URL
echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'
echo ""
echo "📊 View logs:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit 50"
echo ""
