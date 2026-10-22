#!/usr/bin/env bash
# Build the web app with the published KPI files for GitHub Pages (docs/features/016-publication/spec.md).
#   scripts/publish-site.sh            build into apps/app/dist (check it locally first)
#   scripts/publish-site.sh --push     also commit the build to the gh-pages branch and push it
# SITE_BASE_PATH defaults to /<repository name>, the sub-path of a GitHub Pages project site.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
repo_name="$(basename "$(git -C "$root" remote get-url origin 2>/dev/null || echo cyfouri)" .git)"
export SITE_BASE_PATH="${SITE_BASE_PATH:-/$repo_name}"
# Git Bash on Windows would rewrite "/cyfouri" into "C:/Program Files/Git/cyfouri" for node
export MSYS2_ENV_CONV_EXCL="SITE_BASE_PATH" MSYS_NO_PATHCONV=1

(cd "$root/pipeline" && uv run rea sync-app)           # aggregates only: every figure rests on >= 10 sales
cd "$root/apps/app"
npm run postinstall >/dev/null                          # MapLibre worker into public/vendor
rm -rf dist
npx expo export --platform web --output-dir dist
cp dist/index.html dist/404.html                        # deep links on GitHub Pages fall back to the app
touch dist/.nojekyll                                    # serve files whose names start with _
echo "Built apps/app/dist for $SITE_BASE_PATH ($(du -sh dist | cut -f1))."

if [[ "${1:-}" == "--push" ]]; then
  # a fresh one-commit branch: the site never carries the code history
  origin="$(git -C "$root" remote get-url origin)"
  work="$(mktemp -d)"
  cp -r dist/. "$work/"
  git -C "$work" init -q -b gh-pages
  git -C "$work" add -A
  git -C "$work" commit -q -m "Publish site $(date -u +%Y-%m-%dT%H:%MZ)"
  git -C "$work" push -f "$origin" gh-pages
  rm -rf "$work"
fi
