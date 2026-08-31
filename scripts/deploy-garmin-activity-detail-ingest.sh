#!/usr/bin/env bash
# Deploy Cloud Run sidecar from repo root (not triggered by Vercel/git push).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${GOFAST_GCP_PROJECT:-gofast-497201}"
REGION="${GOFAST_GCP_REGION:-us-east4}"
SERVICE="garmin-activity-detail-ingest"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  echo "Or use GCP Console → Cloud Run → $SERVICE → Deploy from source"
  echo "Dockerfile: Dockerfile.garmin-activity-detail-ingest (repo root)"
  exit 1
fi

echo "Deploying $SERVICE to $REGION (project $PROJECT)..."
gcloud run deploy "$SERVICE" \
  --source . \
  --dockerfile Dockerfile.garmin-activity-detail-ingest \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated

echo "Health check:"
curl -sf "https://${SERVICE}-288485670558.${REGION}.run.app/health" | head -c 500 || true
echo ""
