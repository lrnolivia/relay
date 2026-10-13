#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_GITHUB_TOKEN:?RUNNER_GITHUB_TOKEN build secret is required}"

secrets_file="$(mktemp)"
cleanup() {
  rm -f "$secrets_file"
}
trap cleanup EXIT
chmod 600 "$secrets_file"

SECRETS_FILE="$secrets_file" node --input-type=module -e '
  import fs from "node:fs";
  const token = process.env.RUNNER_GITHUB_TOKEN;
  const file = process.env.SECRETS_FILE;
  if (!token || !file) process.exit(2);
  fs.writeFileSync(file, JSON.stringify({ RUNNER_GITHUB_TOKEN: token }), { mode: 0o600 });
'

npx wrangler deploy --secrets-file "$secrets_file"
