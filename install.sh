#!/usr/bin/env bash
# Miro Personal Agent — installer
#
# Installs Miro into ~/.miro/:
#   ~/.miro/bin/miro            launcher
#   ~/.miro/agent/              agent home (built-in extensions + settings)
#   ~/.miro/agent/extensions/   miro-web (Web UI), auto-task-resume, miro-brand
#
# Usage:
#   ./install.sh [--home ~/.miro]
#
# Safe to re-run: built-in components are refreshed, user data
# (settings additions, auth.json, sessions) is preserved.
set -euo pipefail

MIRO_HOME="${MIRO_HOME:-$HOME/.miro}"
while [ $# -gt 0 ]; do
  case "$1" in
    --home) MIRO_HOME="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$MIRO_HOME/agent"
BIN_DIR="$MIRO_HOME/bin"
TEMPLATE="$REPO_DIR/agent-template"

echo "✦ Miro Personal Agent installer"
echo "  home: $MIRO_HOME"

# --- prerequisites -----------------------------------------------------------
if ! command -v pi >/dev/null 2>&1; then
  echo "Miro requires the Pi Agent core (pi) on PATH." >&2
  echo "Install it with: npm i -g @earendil-works/pi-coding-agent" >&2
  exit 1
fi
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }

mkdir -p "$AGENT_DIR/extensions" "$BIN_DIR"

# --- first install: copy the whole template ----------------------------------
if [ ! -f "$AGENT_DIR/.miro-installed" ]; then
  cp -R "$TEMPLATE/." "$AGENT_DIR/"
  touch "$AGENT_DIR/.miro-installed"
  echo "  ✓ created $AGENT_DIR from template"
else
  echo "  ✓ existing Miro home found — refreshing built-in components"
fi

# --- refresh built-in components (always, so re-runs upgrade them) ------------
rm -rf "$AGENT_DIR/extensions/miro-web"
cp -R "$TEMPLATE/extensions/miro-web" "$AGENT_DIR/extensions/miro-web"
cp "$TEMPLATE/extensions/auto-task-resume.ts" "$AGENT_DIR/extensions/auto-task-resume.ts"
cp "$TEMPLATE/extensions/miro-brand.ts" "$AGENT_DIR/extensions/miro-brand.ts"
mkdir -p "$AGENT_DIR/themes"
cp "$TEMPLATE"/themes/*.json "$AGENT_DIR/themes/" 2>/dev/null || true
echo "  ✓ miro-web, auto-task-resume, miro-brand, themes"

# --- merge built-in packages into settings.json (preserves user settings) -----
node - "$AGENT_DIR/settings.json" "npm:pi-subagents" "npm:@mjasnikovs/pi-task" "npm:pi-goal-list-loop-audit" <<'EOF'
const fs = require("fs");
const file = process.argv[2];
const wanted = process.argv.slice(3);
let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
settings.packages = [...new Set([...(settings.packages || []), ...wanted])];
// Miro default theme when the user has not chosen one
if (!settings.theme) settings.theme = "miro-dark";
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
EOF
echo "  ✓ settings.json packages: subagents, pi-task, glla (goal)"

# --- web UI frontend deps ------------------------------------------------------
(cd "$AGENT_DIR/extensions/miro-web" && npm install --silent)
echo "  ✓ miro-web dependencies"

# --- inherit credentials from Pi (only when Miro has none yet) -----------------
if [ ! -f "$AGENT_DIR/auth.json" ] && [ -f "$HOME/.pi/agent/auth.json" ]; then
  cp "$HOME/.pi/agent/auth.json" "$AGENT_DIR/auth.json"
  chmod 600 "$AGENT_DIR/auth.json"
  echo "  ✓ imported credentials from ~/.pi/agent/auth.json"
fi

# --- launcher -------------------------------------------------------------------
cp "$REPO_DIR/bin/miro" "$BIN_DIR/miro"
chmod +x "$BIN_DIR/miro"
echo "  ✓ launcher: $BIN_DIR/miro"

echo ""
echo "Miro is ready. Run it with:"
echo "  $BIN_DIR/miro"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo ""
     echo "Add this to your shell profile to use the bare 'miro' command:"
     echo "  export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
