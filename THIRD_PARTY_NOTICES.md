# Third-Party Notices

Miro Personal Agent reuses several open-source components. This file lists
them, their licenses, and how they are used, satisfying the attribution
obligations of the respective licenses. Miro itself is MIT-licensed, and these
licenses do not restrict the non-commercial or commercial use of Miro.

## Reused as dependencies / CLI tools (used as-is)

| Component | Project | License | How Miro uses it |
|---|---|---|---|
| Pi Agent core | [earendil-works/pi](https://github.com/earendil-works/pi) | Apache-2.0 | White-labeled engine (installed locally, patched via official piConfig hook) |
| MCP TypeScript SDK | [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MIT / Apache-2.0 | MCP client library (`@modelcontextprotocol/client`) for Miro's MCP integration |
| Playwright | [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Browser automation dependency |
| Playwright CLI | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | Apache-2.0 | Token-efficient browser automation CLI + skills for the agent |
| Bubble Tea / Lipgloss | [charmbracelet/bubbletea](https://github.com/charmbracelet/bubbletea), [charmbracelet/lipgloss](https://github.com/charmbracelet/lipgloss) | MIT | Miro TUI framework |
| ripgrep | [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) | MIT / Unlicense | Text search (used by the Pi core grep tool) |

## Invoked as system subprocesses (no linking, no bundling, no modification)

| Component | License | How Miro uses it |
|---|---|---|
| git | GPL-2.0 / LGPL-2.1 | Version control (always a subprocess) |
| gh (GitHub CLI) | MIT | GitHub operations: PRs, releases, auth |
| bubblewrap (`bwrap`) | GPL-2.0+ / LGPL-2.1+ | Lightweight sandboxing for Miro's `bash_sandbox` tool; users install it via their OS package manager. Used strictly as a subprocess. |
| node / npm | MIT | Runtime and package manager |

## Used as reference only (no source copied)

| Component | License | How Miro uses it |
|---|---|---|
| OpenAI Codex CLI | [openai/codex](https://github.com/openai/codex) | Apache-2.0 | Reference for approval modes, sandbox and code-review patterns. Miro does not copy its source; if any code is ever copied, the Apache NOTICE will be preserved. |

## Notes

- npm dependencies carry their own LICENSE files under `node_modules/`, which
  are kept intact.
- bubblewrap is used as a subprocess, so its (L)GPL terms do not impose source
  obligations on Miro, in the same way git/ripgrep do not.
- Apache-2.0 components are consumed as dependencies or reference material; no
  NOTICE-bearing source is copied into this repository.
