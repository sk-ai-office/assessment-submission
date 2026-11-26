#!/bin/zsh
set -e
cd "$(dirname "$0")"
CHILDCARE_NODE_CANDIDATES=("${CHILDCARE_NODE_BIN:-}" "$(command -v node 2>/dev/null || true)" "$HOME"/.nvm/versions/node/*/bin/node(N))
CHILDCARE_NODE=""
for candidate in "${CHILDCARE_NODE_CANDIDATES[@]}"; do
  if [[ -n "$candidate" && -x "$candidate" ]] && "$candidate" -e "require('node:sqlite')" >/dev/null 2>&1; then
    CHILDCARE_NODE="$candidate"
    break
  fi
done
if [[ -z "$CHILDCARE_NODE" ]]; then
  print 'Node with SQLite support is required. Install Node 24 from nodejs.org, then open this file again.'
  read -r '?Press Return to close.'
  exit 1
fi
print 'Open http://127.0.0.1:'"${CHILDCARE_PORT:-4180}"' in your browser.'
print 'Keep this window open while using the dashboard. Press Control-C to stop.'
exec "$CHILDCARE_NODE" server/index.js
