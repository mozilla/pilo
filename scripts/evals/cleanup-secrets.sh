#!/bin/bash
set -euo pipefail

# Script to cleanup temporary GitHub token secrets created for Argo workflows
# Expected environment variables:
#   GITHUB_RUN_ID - GitHub Actions run ID used for secret naming

# Validate required environment variables
if [[ -z "${GITHUB_RUN_ID:-}" ]]; then
  echo "Error: Required environment variable GITHUB_RUN_ID is not set"
  exit 1
fi

echo "Cleaning up GitHub token secret..."
# Clean up the temporary secret after workflow submission
kubectl delete secret "github-token-${GITHUB_RUN_ID}" -n argo --ignore-not-found=true

echo "✅ Cleanup complete"
