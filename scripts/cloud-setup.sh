#!/usr/bin/env bash
# Prepares a Claude Code on the web (claude.ai/code) session: Node dependencies and Chrome for rendering.
# Runs as the environment's setup script and as a SessionStart hook; it is idempotent and quick when
# everything is already in place. Outside a cloud session it does nothing unless ONEPAGER_FORCE_SETUP=1.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${CLAUDE_CODE_REMOTE:-}${CLAUDE_CODE_REMOTE_SESSION_ID:-}${ONEPAGER_FORCE_SETUP:-}" ]]; then
  exit 0
fi

echo "onepager: preparing cloud session (node $(node --version))"

# 1. Dependencies. puppeteer's postinstall also downloads Chrome for Testing into ~/.cache/puppeteer.
if [[ ! -d node_modules || package-lock.json -nt node_modules ]]; then
  npm ci --no-audit --no-fund
fi

# 2. Chrome. If the postinstall download or system libraries are missing, install them explicitly.
if ! node scripts/check-chrome.mjs; then
  echo "onepager: installing Chrome for Testing (with system dependencies if permitted)"
  npx --yes puppeteer browsers install chrome --install-deps \
    || npx --yes puppeteer browsers install chrome \
    || true
  node scripts/check-chrome.mjs
fi

# 3. Smoke test: render a template sample end to end.
node src/cli.js render templates/classic/sample.content.json --out output/_samples/classic | tail -1
echo "onepager: ready"
