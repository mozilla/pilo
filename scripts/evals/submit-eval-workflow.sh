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
kubectl create -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: spark-batch-github-eval-
  namespace: argo
spec:
  workflowTemplateRef:
    name: spark-batch-eval-from-file
  arguments:
    parameters:
    # Use regular nodes for CI/CD reliability (no preemption)
    - name: node-type
      value: "regular"
    - name: evaluations-gcs-key
      value: "eval-inputs/test.jsonl"
    # Agent configuration
    - name: agent-type
      value: "spark"
    - name: agent-version
      value: "${GITHUB_SHA}"
    # Agent build metadata
    - name: agent-build-id
      value: "${GITHUB_SHA}"
    - name: agent-build-date
      value: "${HEAD_COMMIT_TIMESTAMP}"
    # GitHub context for status updates
    - name: github-repo
      value: "${GITHUB_REPOSITORY}"
    - name: github-sha
      value: "${GITHUB_SHA}"
    - name: github-ref
      value: "${GITHUB_REF}"
    - name: github-run-id
      value: "${GITHUB_RUN_ID}"
    # Secret name containing GitHub token
    - name: github-token-secret
      value: "github-token-${GITHUB_RUN_ID}"
EOF

echo "✅ Workflow submitted successfully"

# Get the workflow name
WORKFLOW_NAME=$(kubectl get workflows -n argo --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')
echo "Workflow name: $WORKFLOW_NAME"
echo "View in Argo UI:"
echo "kubectl -n argo port-forward service/argo-server 2746:2746"
echo "https://localhost:2746/workflows/argo/$WORKFLOW_NAME"

# Export workflow name for subsequent steps
echo "WORKFLOW_NAME=${WORKFLOW_NAME}" >> "$GITHUB_OUTPUT"
