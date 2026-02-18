#!/bin/bash

# Spark Hotfix Finish Script
# Completes a hotfix: bumps package.json version, merges to main and develop,
# tags, and pushes. Run this after committing your fixes on a hotfix/* branch.
#
# Usage: ./scripts/hotfix-finish.sh

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

# Check we're on a hotfix branch and extract the version from the branch name
CURRENT_BRANCH=$(git branch --show-current)
if [[ ! "$CURRENT_BRANCH" =~ ^hotfix/(.+)$ ]]; then
    log_error "Must be on a hotfix/* branch. Current branch: $CURRENT_BRANCH"
    exit 1
fi

NEW_VERSION="${BASH_REMATCH[1]}"
log_info "Finishing hotfix for version: $NEW_VERSION"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_error "You have uncommitted changes. Please commit your fixes first."
    exit 1
fi

# Confirm with user
echo ""
log_warning "This will:"
echo "  1. Update package.json version to $NEW_VERSION"
echo "  2. Commit the version change"
echo "  3. Finish the hotfix (merge to main and develop)"
echo "  4. Push all branches and tags"
echo ""
log_warning "Note: finishing the hotfix will also merge into develop. If develop has"
echo "  diverged significantly from main, you may need to resolve merge conflicts."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Hotfix finish cancelled"
    exit 0
fi

# Update package.json version
log_info "Updating package.json version to $NEW_VERSION..."
npm version "$NEW_VERSION" --no-git-tag-version

# Commit the version change
log_info "Committing version change..."
git add package.json
git commit -m "Bump version to $NEW_VERSION"

# Finish git flow hotfix
log_info "Finishing git flow hotfix..."
# git-flow opens an editor for the tag message; use a temp script to supply it
# without interactive input (macOS getopt doesn't support spaces in -m flag)
TAG_EDITOR=$(mktemp)
cat > "$TAG_EDITOR" << EOF
#!/bin/sh
echo "Hotfix $NEW_VERSION" > "\$1"
EOF
chmod +x "$TAG_EDITOR"
GIT_MERGE_AUTOEDIT=no GIT_EDITOR="$TAG_EDITOR" git flow hotfix finish "$NEW_VERSION"
rm -f "$TAG_EDITOR"

# Push everything
log_info "Pushing to remote..."
git push origin develop main --tags

log_success "Hotfix $NEW_VERSION completed successfully!"
log_info "GitHub Actions will now build and create the release automatically."

# Show next steps
echo ""
log_info "What happens next:"
echo "  1. GitHub Actions builds the project"
echo "  2. Creates release v$NEW_VERSION with installation instructions"
echo "  3. Users can install with: npm install https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/').git"
