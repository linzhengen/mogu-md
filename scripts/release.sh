#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST="$PROJECT_DIR/manifest.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
  cat <<EOF
Usage: release.sh [options]

Options:
  --bump TYPE     Bump version before building (patch|minor|major)
  --tag           Create git commit + tag after bump
  --dry-run       Show what would happen without making changes
  --help          Show this message

Examples:
  release.sh                        Build ZIP with current version
  release.sh --bump patch           Bump patch version and build
  release.sh --bump minor --tag     Bump minor version, build, commit + tag
EOF
}

# ── Parse arguments ───────────────────────────────────────────
BUMP_TYPE=""
DO_TAG=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump)
      BUMP_TYPE="$2"
      if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
        echo -e "${RED}Error: --bump must be patch, minor, or major${NC}"
        exit 1
      fi
      shift 2
      ;;
    --tag)
      DO_TAG=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      usage
      exit 1
      ;;
  esac
done

# ── Read current version ──────────────────────────────────────
CURRENT_VERSION=$(jq -r '.version' "$MANIFEST")
echo -e "${CYAN}Current version:${NC} $CURRENT_VERSION"

# ── Bump version if requested ─────────────────────────────────
if [[ -n "$BUMP_TYPE" ]]; then
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP_TYPE" in
    major)
      MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor)
      MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch)
      PATCH=$((PATCH + 1)) ;;
  esac
  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
  echo -e "${GREEN}Bumping to:${NC}   $NEW_VERSION  (${BUMP_TYPE})"

  if $DRY_RUN; then
    echo -e "${CYAN}[dry-run]${NC} Would update manifest.json"
  else
    jq --arg v "$NEW_VERSION" '.version = $v' "$MANIFEST" > "${MANIFEST}.tmp"
    mv "${MANIFEST}.tmp" "$MANIFEST"
    echo -e "${GREEN}Updated:${NC}      manifest.json"
  fi
else
  NEW_VERSION="$CURRENT_VERSION"
fi

# ── Build ZIP ─────────────────────────────────────────────────
ZIP_FILE="mogu-md-v${NEW_VERSION}.zip"
ZIP_PATH="$PROJECT_DIR/$ZIP_FILE"

# Remove old zip if exists
if [[ -f "$ZIP_PATH" ]]; then
  rm "$ZIP_PATH"
fi

if $DRY_RUN; then
  echo -e "${CYAN}[dry-run]${NC} Would create: $ZIP_FILE"
else
  cd "$PROJECT_DIR"
  zip -r -q "$ZIP_FILE" \
    manifest.json \
    background.js \
    content.js \
    lib/ \
    icons/ \
    PRIVACY.md \
    -x "*.DS_Store" "*.map"

  SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  echo -e "${GREEN}Created:${NC}      $ZIP_FILE  (${SIZE})"
fi

# ── Git tag ───────────────────────────────────────────────────
if $DO_TAG; then
  if [[ -z "$BUMP_TYPE" ]]; then
    echo -e "${RED}Error: --tag requires --bump (nothing to tag)${NC}"
    exit 1
  fi

  TAG="v${NEW_VERSION}"

  if $DRY_RUN; then
    echo -e "${CYAN}[dry-run]${NC} Would run:"
    echo "  git add manifest.json"
    echo "  git commit -m \"release: v${NEW_VERSION}\""
    echo "  git tag -a \"$TAG\" -m \"Release $TAG\""
  else
    cd "$PROJECT_DIR"
    # Only commit if there are staged or changed files
    if git diff --quiet && git diff --cached --quiet && git ls-files --others --exclude-standard | grep -q .; then
      # There are untracked files, but no changes to tracked files
      git add manifest.json
      git commit -m "release: v${NEW_VERSION}" || true
    else
      git add manifest.json
      if ! git diff --cached --quiet; then
        git commit -m "release: v${NEW_VERSION}"
      else
        echo -e "${CYAN}Nothing to commit${NC}"
      fi
    fi

    # Check if tag already exists
    if git rev-parse "$TAG" >/dev/null 2>&1; then
      echo -e "${RED}Error: tag $TAG already exists${NC}"
      exit 1
    fi

    git tag -a "$TAG" -m "Release $TAG"
    echo -e "${GREEN}Tagged:${NC}       $TAG"
    echo
    echo -e "${CYAN}To push:${NC}"
    echo "  git push origin main --follow-tags"
  fi
fi

# ── Summary ───────────────────────────────────────────────────
echo
echo -e "${CYAN}── Done ─────────────────────────────────────────${NC}"
echo -e "  Version: ${GREEN}${NEW_VERSION}${NC}"
echo -e "  ZIP:     ${ZIP_FILE}"
if $DO_TAG && ! $DRY_RUN; then
  echo -e "  Tag:     v${NEW_VERSION}"
fi
