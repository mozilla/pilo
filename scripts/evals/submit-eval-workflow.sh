#!/bin/bash
set -euo pipefail

# Script to submit an Argo workflow for Spark evaluations
# Expected environment variables:
#   GITHUB_RUN_ID - GitHub Actions run ID for secret naming
#   GITHUB_TOKEN - GitHub token for status updates
#   GITHUB_REPOSITORY - Repository name (owner/repo)
#   GITHUB_SHA - Git commit SHA
#   GITHUB_REF - Git ref (branch/tag)
#   HEAD_COMMIT_TIMESTAMP - Timestamp of the head commit

# Validate required environment variables
required_vars=(
  "GITHUB_RUN_ID"
  "GITHUB_TOKEN"
  "GITHUB_REPOSITORY"
  "GITHUB_SHA"
  "GITHUB_REF"
  "HEAD_COMMIT_TIMESTAMP"
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

echo "Creating GitHub token secret for workflow..."
# Create a Kubernetes secret with the GitHub token for this workflow
kubectl create secret generic "github-token-${GITHUB_RUN_ID}" \
  -n argo \
  --from-literal="token=${GITHUB_TOKEN}"

echo "Submitting Argo workflow..."
# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use envsubst to substitute environment variables in the template
envsubst < "$SCRIPT_DIR/templates/eval-workflow.yaml" | kubectl create -f -

echo "✅ Workflow submitted successfully"

# Get the workflow name
WORKFLOW_NAME=$(kubectl get workflows -n argo --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')
echo "Workflow name: $WORKFLOW_NAME"
echo "View in Argo UI:"
echo "kubectl -n argo port-forward service/argo-server 2746:2746"
echo "https://localhost:2746/workflows/argo/$WORKFLOW_NAME"

# Export workflow name for subsequent steps
echo "WORKFLOW_NAME=${WORKFLOW_NAME}" >> "$GITHUB_OUTPUT"
