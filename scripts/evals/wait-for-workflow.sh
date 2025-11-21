#!/bin/bash
set -euo pipefail

# Script to wait for an Argo workflow to complete
# Expected environment variables:
#   WORKFLOW_NAME - Name of the Argo workflow to monitor
# Optional environment variables:
#   TIMEOUT - Maximum time to wait in seconds (default: 3600)
#   INTERVAL - Polling interval in seconds (default: 10)
#   MAX_RETRIES - Maximum retries for transient errors (default: 3)

# Get workflow name from environment or command line
WORKFLOW_NAME="${WORKFLOW_NAME:-$(kubectl get workflows -n argo --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')}"
echo "Waiting for workflow $WORKFLOW_NAME to complete..."

# Configuration with defaults
TIMEOUT="${TIMEOUT:-3600}"
INTERVAL="${INTERVAL:-10}"
MAX_RETRIES="${MAX_RETRIES:-3}"

# Wait for workflow to complete
ELAPSED=0

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  # Get workflow status details with retry on transient errors
  PHASE=""
  RETRY_COUNT=0

  while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
    if WORKFLOW_JSON=$(kubectl get workflow -n argo "$WORKFLOW_NAME" -o json 2>&1); then
      # Successfully got workflow data
      PHASE=$(echo "$WORKFLOW_JSON" | jq -r '.status.phase // ""')
      PROGRESS=$(echo "$WORKFLOW_JSON" | jq -r '.status.progress // ""')
      MESSAGE=$(echo "$WORKFLOW_JSON" | jq -r '.status.message // ""')
      SUCCEEDED=$(echo "$WORKFLOW_JSON" | jq '[.status.nodes // {} | .[] | select(.phase=="Succeeded")] | length')
      FAILED=$(echo "$WORKFLOW_JSON" | jq '[.status.nodes // {} | .[] | select(.phase=="Failed")] | length')
      RUNNING=$(echo "$WORKFLOW_JSON" | jq '[.status.nodes // {} | .[] | select(.phase=="Running")] | length')
      break
    else
      # kubectl command failed, retry after a brief delay
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; then
        echo "⚠️  Transient API error (attempt $RETRY_COUNT/$MAX_RETRIES), retrying..."
        sleep 2
      else
        echo "❌ Failed to get workflow status after $MAX_RETRIES attempts"
        echo "Error: $WORKFLOW_JSON"
        exit 1
      fi
    fi
  done

  # Build status line
  STATUS_LINE="[$ELAPSED s] Phase: $PHASE"
  if [ -n "$PROGRESS" ]; then
    STATUS_LINE="$STATUS_LINE | Progress: $PROGRESS"
  fi
  STATUS_LINE="$STATUS_LINE | ✅ $SUCCEEDED | ❌ $FAILED | ⚙️  $RUNNING"
  if [ -n "$MESSAGE" ]; then
    STATUS_LINE="$STATUS_LINE | $MESSAGE"
  fi

  echo "$STATUS_LINE"

  if [ "$PHASE" = "Succeeded" ]; then
    echo "✅ Workflow completed successfully!"
    exit 0
  elif [ "$PHASE" = "Failed" ] || [ "$PHASE" = "Error" ]; then
    echo "❌ Workflow failed with phase: $PHASE"
    echo "View logs with: kubectl logs -n argo -l workflows.argoproj.io/workflow=$WORKFLOW_NAME"
    exit 1
  fi

  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "⏱️ Workflow timed out after ${TIMEOUT}s"
# Final status check with retry
FINAL_PHASE=$(kubectl get workflow -n argo "$WORKFLOW_NAME" -o jsonpath='{.status.phase}' 2>/dev/null || echo "unknown")
echo "Current phase: $FINAL_PHASE"
exit 1
