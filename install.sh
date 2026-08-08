#!/usr/bin/env bash
# Miro Personal Agent — installer
#
# Installs Miro into ~/.miro/:
#   ~/.miro/bin/miro            launcher
#   ~/.miro/core/               local Pi fork (built from repo core/, white-labeled)
#   ~/.miro/agent/              agent home (settings, skills, plugins, themes)
#   ~/.miro/agent/plugins/      declarative plugins (commands / skills)
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
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }

mkdir -p "$AGENT_DIR" "$BIN_DIR"

# --- version stamp (single source of truth: VERSION in the repo root) --------
[ -f "$REPO_DIR/VERSION" ] && cp "$REPO_DIR/VERSION" "$AGENT_DIR/VERSION" || true

# --- first install: copy the whole template ----------------------------------
if [ ! -f "$AGENT_DIR/.miro-installed" ]; then
  cp -R "$TEMPLATE/." "$AGENT_DIR/"
  touch "$AGENT_DIR/.miro-installed"
  echo "  ✓ created $AGENT_DIR from template"
else
  echo "  ✓ existing Miro home found — refreshing built-in components"
fi

# --- refresh themes + plugins + bundled skills (always, so re-runs upgrade) ------
mkdir -p "$AGENT_DIR/themes" "$AGENT_DIR/plugins" "$AGENT_DIR/skills"
cp "$TEMPLATE"/themes/*.json "$AGENT_DIR/themes/" 2>/dev/null || true
# Built-in skills from the agent template (miro-workflow etc.); playwright-cli is
# handled below. User-added skills are preserved (never removed).
rm -rf "$AGENT_DIR/skills/miro-workflow"
cp -R "$TEMPLATE/skills/miro-workflow" "$AGENT_DIR/skills/miro-workflow" 2>/dev/null || true
echo "  ✓ themes + plugins + bundled skills"

# --- merge built-in packages into settings.json (preserves user settings) -----
node - "$AGENT_DIR/settings.json" "npm:pi-subagents" "npm:@mjasnikovs/pi-task" "npm:pi-goal-list-loop-audit" <<'EOF'
const fs = require("fs");
const file = process.argv[2];
const wanted = process.argv.slice(3);
let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
settings.packages = [...new Set([...(settings.packages || []), ...wanted])];
// Miro default theme when the user has not chosen one
if (!settings.theme) settings.theme = "miro-opencode";
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
EOF
echo "  ✓ settings.json packages: subagents, pi-task, glla (goal)"

# --- Browser automation (playwright-cli + skill) --------------------------------
echo "  ⏳ installing Playwright CLI (@playwright/cli)..."
npm install -g --no-audit --no-fund @playwright/cli playwright >/dev/null 2>&1 || npm install -g @playwright/cli playwright
mkdir -p "$AGENT_DIR/skills"
rm -rf "$AGENT_DIR/skills/playwright-cli"
cp -R "$(npm root -g)/@playwright/cli/skills/playwright-cli" "$AGENT_DIR/skills/playwright-cli"
echo "  ✓ playwright-cli + skill"
echo "  ⏳ downloading Chromium (~120MB)..."
playwright install chromium >/dev/null 2>&1 || echo "  ⚠ chromium download failed (retry: playwright install chromium)"
echo "  ⚠ if browser launch fails with missing libs, run once (sudo): playwright install-deps chromium"

# --- Miro core: local Pi fork (white-labeled, built from source) ----------------
# The core is a private fork of the Pi coding-agent monorepo, kept in core/ of
# this repository. It is installed into $MIRO_HOME/core and built locally.
# The white-label (name: miro, configDir: .miro) is baked into the fork's
# package.json (piConfig), so no runtime patching is needed. Global pi stays
# untouched.
CORE_DIR="$MIRO_HOME/core"
CORE_BIN="$CORE_DIR/packages/coding-agent/dist/cli.js"
CORE_FORK="$REPO_DIR/core"

# The fork lives in core/ as an independent git repo (gitignored). If it is
# missing (e.g. fresh clone), fetch it from GitHub and pin the miro/dev branch.
if [ ! -d "$CORE_FORK/.git" ]; then
  echo "  ⏳ fetching Miro core fork (earendil-works/pi, branch miro/dev)..."
  git clone --branch miro/dev https://github.com/earendil-works/pi.git "$CORE_FORK" 2>&1 | tail -2
fi

install_core_sources() {
  mkdir -p "$CORE_DIR"
  # Copy the fork sources (no node_modules / .git / dist) into the Miro home.
  ( cd "$CORE_FORK" && tar --exclude=node_modules --exclude=.git --exclude=dist -cf - . ) | ( cd "$CORE_DIR" && tar -xf - )
  if [ ! -d "$CORE_DIR/node_modules" ]; then
    echo "  ⏳ installing Miro core dependencies (first run, a few minutes)..."
    (cd "$CORE_DIR" && npm ci --no-audit --no-fund --silent)
  fi
}

if [ ! -f "$CORE_DIR/package.json" ]; then
  echo "  ⏳ installing Miro core (local Pi fork)..."
  install_core_sources
else
  # Refresh fork sources on re-run (keeps node_modules; drops stale dist).
  ( cd "$CORE_FORK" && tar --exclude=node_modules --exclude=.git --exclude=dist -cf - . ) | ( cd "$CORE_DIR" && tar -xf - )
fi

# Rebuild so dist/ reflects the current fork source (always on re-run).
if [ ! -x "$CORE_BIN" ]; then
  # Offline build needs the generated provider model data, which is gitignored
  # upstream and generated from models.dev over the network. When absent, pull
  # it from the published pi-ai npm package (registry is reachable).
  AI_DATA="$CORE_DIR/packages/ai/src/providers/data"
  if [ ! -f "$AI_DATA/.manifest.json" ]; then
    AI_VER="$(node -e "console.log(require('$CORE_DIR/packages/ai/package.json').version)")"
    echo "  ⏳ fetching provider model data (@earendil-works/pi-ai@$AI_VER)..."
    ( cd "$CORE_DIR" && npm pack --silent "@earendil-works/pi-ai@$AI_VER" && \
      tar -xzf "earendil-works-pi-ai-$AI_VER.tgz" package/dist/providers/data && \
      mkdir -p "$AI_DATA" && cp package/dist/providers/data/*.json "$AI_DATA/" && \
      cp package/dist/providers/data/.manifest.json "$AI_DATA/" && \
      rm -rf "earendil-works-pi-ai-$AI_VER.tgz" package )
    echo "  ✓ model data ready"
  fi
  echo "  ⏳ building Miro core (Pi fork)..."
  (cd "$CORE_DIR" && npm run build:offline 2>&1 | tail -5)
  echo "  ✓ Miro core built (white-label piConfig baked in)"
else
  echo "  ✓ Miro core present ($CORE_BIN)"
fi

# --- inherit credentials from Pi (only when Miro has none yet) -----------------
if [ ! -f "$AGENT_DIR/auth.json" ] && [ -f "$HOME/.pi/agent/auth.json" ]; then
  cp "$HOME/.pi/agent/auth.json" "$AGENT_DIR/auth.json"
  chmod 600 "$AGENT_DIR/auth.json"
  echo "  ✓ imported credentials from ~/.pi/agent/auth.json"
fi

# --- Miro TUI: native Bubble Tea frontend -------------------------------------
# Built from source; skipped when Go is unavailable (falls back to core TUI).
if command -v go >/dev/null 2>&1; then
  GO=go
elif [ -x "$HOME/.local/go/bin/go" ]; then
  GO="$HOME/.local/go/bin/go"
else
  GO=""
fi
if [ -n "$GO" ]; then
  echo "  ⏳ building Miro TUI (Go)..."
  (cd "$REPO_DIR/miro-tui" && "$GO" build -o "$BIN_DIR/miro-tui" .)
  echo "  ✓ miro-tui binary: $BIN_DIR/miro-tui"
else
  echo "  ⚠ go not found — skipping miro-tui build (falling back to core TUI)"
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
