#!/bin/bash

# Pilo Release Script
# Usage: ./scripts/release.sh [major|minor|patch]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Validate arguments
if [ $# -ne 1 ]; then
    log_error "Usage: $0 [major|minor|patch]"
    echo ""
    echo "Examples:"
    echo "  $0 patch   # 1.0.0 -> 1.0.1"
    echo "  $0 minor   # 1.0.1 -> 1.1.0" 
    echo "  $0 major   # 1.1.0 -> 2.0.0"
    exit 1
fi

RELEASE_TYPE=$1

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; then
    log_error "Release type must be major, minor, or patch"
    exit 1
fi

# Check if we're on develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    log_error "Must be on develop branch to start a release. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Pull latest changes
log_info "Pulling latest changes from develop..."
git pull origin develop

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

# Confirm with user
echo ""
log_warning "This will:"
echo "  1. Start git flow release $NEW_VERSION"
echo "  2. Update package.json version to $NEW_VERSION"
echo "  3. Commit the version change"
echo "  4. Finish the release (merge to main and develop)"
echo "  5. Push all branches and tags"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Release cancelled"
    exit 0
fi

# Start git flow release
log_info "Starting git flow release $NEW_VERSION..."
git flow release start "$NEW_VERSION"

# Update package.json version
log_info "Updating package.json version to $NEW_VERSION..."
npm version "$NEW_VERSION" --no-git-tag-version

# Commit the version change
log_info "Committing version change..."
git add package.json
git commit -m "Bump version to $NEW_VERSION"

# Finish git flow release
log_info "Finishing git flow release..."
git flow release finish "$NEW_VERSION" -m "Release $NEW_VERSION"

# Push everything
log_info "Pushing to remote..."
git push origin develop main --tags

log_success "Release $NEW_VERSION completed successfully!"
log_info "GitHub Actions will now build and create the release automatically."

# Show next steps
echo ""
log_info "What happens next:"
echo "  1. GitHub Actions builds the project"
echo "  2. Creates release v$NEW_VERSION with installation instructions"
echo "  3. Users can install with: npm install https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/').git"