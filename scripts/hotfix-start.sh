#!/bin/bash

# Spark Hotfix Start Script
# Creates a hotfix branch off main. After running this, apply your fixes,
# commit them, then run ./scripts/hotfix-finish.sh to complete the release.
#
# Usage: ./scripts/hotfix-start.sh [major|minor|patch]
# Defaults to patch if no argument is given.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check if git flow is available
if ! command -v git-flow &> /dev/null; then
    log_error "git-flow is not installed. Please install it first:"
    echo "  macOS: brew install git-flow"
    echo "  Ubuntu: sudo apt install git-flow"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check if git flow is initialized
if ! git config --get gitflow.branch.master > /dev/null 2>&1; then
    log_warning "Git flow not initialized. Initializing with defaults..."
    git flow init -d
fi

# Default to patch if no argument given
RELEASE_TYPE=${1:-patch}

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; then
    log_error "Release type must be major, minor, or patch"
    echo ""
    echo "Usage: $0 [major|minor|patch]  (default: patch)"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_error "Must be on main branch to start a hotfix. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Pull latest changes
log_info "Pulling latest changes from main..."
git pull origin main

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
log_info "Current version: $CURRENT_VERSION"

# Calculate new version
case $RELEASE_TYPE in
    "major")
        NEW_VERSION=$(node -p "
            const v = '$CURRENT_VERSION'.split('.');
            [parseInt(v[0])+1, 0, 0].join('.')
        ")
        ;;
    "minor")
        NEW_VERSION=$(node -p "
            const v = '$CURRENT_VERSION'.split('.');
            [v[0], parseInt(v[1])+1, 0].join('.')
        ")
        ;;
    "patch")
        NEW_VERSION=$(node -p "
            const v = '$CURRENT_VERSION'.split('.');
            [v[0], v[1], parseInt(v[2])+1].join('.')
        ")
        ;;
esac

log_info "New version will be: $NEW_VERSION"

# Start git flow hotfix
log_info "Starting git flow hotfix $NEW_VERSION..."
git flow hotfix start "$NEW_VERSION"

log_success "Hotfix branch hotfix/$NEW_VERSION created."
echo ""
log_info "Next steps:"
echo "  1. Apply your fixes and commit them"
echo "  2. Run ./scripts/hotfix-finish.sh to merge, tag, and push"
