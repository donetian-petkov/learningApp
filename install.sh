#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE_MAJOR=22

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found on PATH." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt "${MIN_NODE_MAJOR}" ]; then
  echo "Node.js ${MIN_NODE_MAJOR}+ is required. Found $(node -v)." >&2
  exit 1
fi

mkdir -p "${ROOT_DIR}/data"
cd "${ROOT_DIR}"

echo "Initializing SQLite database..."
node --input-type=module <<'EOF'
import { createStorageAdapter } from "./db.mjs";

const store = createStorageAdapter();
try {
  const snapshot = store.getSnapshot();
  console.log(`Initialized ${snapshot.lessons.length} lessons, ${snapshot.reviews.length} reviews, and ${snapshot.kanjiEntries.length} kanji entries.`);
} finally {
  store.close();
}
EOF

echo
echo "Setup complete."
echo "Run the app with: npm run dev"
echo "Run tests with: npm test"
