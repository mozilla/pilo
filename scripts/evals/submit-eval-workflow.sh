#!/bin/bash
set -euo pipefail

# Script to submit an Argo workflow for Spark evaluations
#
# This script dynamically determines which eval input file to use based on the branch name.
# Branch naming convention: evals/{eval-name}/{suffix}
#   - evals/partial/my-test → eval-inputs/partial.jsonl
#   - evals/full/experiment → eval-inputs/full.jsonl
#
# The script validates that the eval input file exists in GCS before submitting.
#
# Expected environment variables:
#   GITHUB_RUN_ID - GitHub Actions run ID for secret naming
#   GITHUB_TOKEN - GitHub token for status updates
#   GITHUB_REPOSITORY - Repository name (owner/repo)
#   GITHUB_SHA - Git commit SHA
#   GITHUB_REF - Git ref (branch/tag) - must match pattern evals/{eval-name}/*
#   HEAD_COMMIT_TIMESTAMP - Timestamp of the head commit
#
# Optional environment variables:
#   GCS_BUCKET - GCS bucket name (default: spark-eval-artifacts)

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

# Parse branch name to determine eval input file
# Expected format: refs/heads/evals/{eval-name}/{suffix}
# Example: refs/heads/evals/partial/test → eval-inputs/partial.jsonl
echo "Parsing branch name: $GITHUB_REF"

if [[ "$GITHUB_REF" =~ ^refs/heads/evals/([^/]+)/ ]]; then
  EVAL_NAME="${BASH_REMATCH[1]}"
  export EVALUATIONS_GCS_KEY="eval-inputs/${EVAL_NAME}.jsonl"
  echo "✓ Detected eval type: $EVAL_NAME"
  echo "✓ Using GCS key: $EVALUATIONS_GCS_KEY"
else
  echo "Error: Branch name does not match expected pattern 'evals/{eval-name}/*'"
  echo "Current branch: $GITHUB_REF"
  echo "Expected format: refs/heads/evals/{eval-name}/{suffix}"
  echo "Example: refs/heads/evals/partial/my-test"
  exit 1
fi

# Validate that the eval input file exists in GCS
GCS_BUCKET="${GCS_BUCKET:-spark-eval-artifacts}"
GCS_PATH="gs://${GCS_BUCKET}/${EVALUATIONS_GCS_KEY}"

echo "Validating eval input file exists: $GCS_PATH"
if ! gsutil ls "$GCS_PATH" &>/dev/null; then
  echo "Error: Eval input file not found in GCS"
  echo "Expected: $GCS_PATH"
  echo ""
  echo "Available eval input files:"
  gsutil ls "gs://${GCS_BUCKET}/eval-inputs/" 2>/dev/null || echo "  (none found or no access)"
  echo ""
  echo "To upload your eval file:"
  echo "  gsutil cp your-tasks.jsonl $GCS_PATH"
  exit 1
fi

echo "✓ Eval input file exists: $GCS_PATH"

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
