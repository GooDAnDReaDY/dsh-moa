#!/usr/bin/env bash
set -euo pipefail

# deploy.sh for @goodandready/dsh-moa — the single documented deploy entry point.
#
# Delivery path for a DSH plugin: main -> quality gate (tests + package and
# identity checks below) -> explicit owner approval -> install the published
# immutable npm version into the target profile. This script runs the
# pre-deploy checks and, with --install, performs the profile install in the
# same way as the dsh-clinebot family template. No force flags, no secret
# handling, no source copying.
#
# Usage:
#   ./deploy.sh             # pre-deploy checks only (tests, package, identity)
#   ./deploy.sh --install   # install published @goodandready/dsh-moa into $DSH_PROFILE

PROFILE="${DSH_PROFILE:-web}"
PACKAGE="@goodandready/dsh-moa"

echo "== dsh-moa deploy checks (profile: ${PROFILE}) =="

echo "-- Test suite"
node --test test/*.test.mjs

echo "-- npm package size check (DSH store limit: 262144 bytes per file)"
npm pack --dry-run --json | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  const data = JSON.parse(s);
  const files = (data[0] && data[0].files) || [];
  let blocked = false;
  for (const f of files) {
    if (f.size > 262144) { console.error("BLOCKED " + f.size + " bytes " + f.path); blocked = true; }
    else if (f.size >= 256000) { console.error("WARNING " + f.size + " bytes " + f.path); }
  }
  process.exit(blocked ? 1 : 0);
});
'

echo "-- Package identity check (name must match in all three places)"
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const patch = fs.readFileSync("cordis.patch.yml", "utf8");
const client = fs.readFileSync("lib/client.js", "utf8");
const name = "@goodandready/dsh-moa";
if (pkg.name !== name) { console.error("IDENTITY MISMATCH in package.json"); process.exit(1); }
if (!patch.includes(name)) { console.error("IDENTITY MISMATCH in cordis.patch.yml"); process.exit(1); }
if (!client.includes("id: \x27" + name + "\x27")) { console.error("IDENTITY MISMATCH in lib/client.js"); process.exit(1); }
console.log("identity ok");
'

if [ "${1:-}" = "--install" ]; then
  echo "-- Installing published package into profile ${PROFILE}"
  dsh plugin --profile "$PROFILE" remove dsh-moa || true
  dsh plugin --profile "$PROFILE" add "$PACKAGE"
  echo "Installed $PACKAGE into profile $PROFILE; restart the profile service through the supported service workflow."
else
  echo "Checks passed. Profile install runs with: $0 --install (published npm version, after owner approval)."
fi
