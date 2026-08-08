```
███╗   ███╗ ██╗ ██████╗   ██████╗ 
████╗ ████║ ██║ ██╔══██╗ ██╔═══██╗
██╔████╔██║ ██║ ██████╔╝ ██║   ██║
██║╚██╔╝██║ ██║ ██╔══██╗ ██║   ██║
██║ ╚═╝ ██║ ██║ ██║  ██║ ╚██████╔╝
╚═╝     ╚═╝ ╚═╝ ╚═╝  ╚═╝  ╚═════╝ 
```

<p align="center">
  <a href="https://github.com/HiddenKismet/miro-agent/releases"><img alt="release" src="https://img.shields.io/github/v/release/HiddenKismet/miro-agent?style=flat-square" /></a>
  <a href="https://github.com/HiddenKismet/miro-agent/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2e8c76?style=flat-square" /></a>
  <a href="https://github.com/earendil-works/pi"><img alt="built on pi" src="https://img.shields.io/badge/built%20on-Pi%20Agent-5fbfa4?style=flat-square" /></a>
</p>

> 让 Miro 梳理你的思绪 · *Let Miro sort your mind*

# Miro Personal Agent

Miro 是基于 [Pi Agent](https://github.com/earendil-works/pi) 二次定制开发的私人智能代理，作为你的专属数字化幕僚：承接碎片化思考、整理资料、规划任务、多场景推理。内核是 Pi，产品是 Miro。

- **Miro Web**：极光玻璃浏览器界面（聊天、目标、任务、凭据、会话管理）
- **Miro TUI**：原生终端界面，启动即显示彩色 MIRO 横幅
- **core**：白标化的 Pi Agent 引擎，与全局 pi 并存互不影响

## 了解更多

- [Pi Agent](https://github.com/earendil-works/pi)：Miro 的内核与灵感来源
- 打开 Miro 后输入 `/web`，或让它自己打开浏览器

## 内置能力

| 能力 | 说明 | 入口 |
|---|---|---|
| **Miro Web** | 浏览器界面：聊天、目标、任务工作流、凭据、会话管理、Git 面板 | `/web` |
| **Subagents** | 子代理并行/串行协作 | `/run` `/parallel` |
| **Dynamic Workflow** | 模型现场编写确定性 JS 编排脚本（agent/parallel/pipeline），**后台运行**（注册即返回 runId，完成异步通知），实时进度面板 + kill/resume | `workflow` 工具 / `/workflows` / `~/.miro/agent/workflows/` |
| **Hook 系统** | 全量 27 种生命周期钩子（PreToolUse/PostToolUse/Stop/SessionStart…），settings.json 配置 + 子进程执行，PreToolUse 决策并入权限管道 | `~/.miro/agent/settings.json` 的 `hooks` 字段 / `/hooks` |
| **Tasks** | 工作流任务 + 重启自动续跑 | `/task` |
| **Goal** | 目标 + 列表 + 审计 + 循环优化 | `/goal` `/list` `/loop` |
| **Git** | 智能提交、仓库状态、发布流程（版本 bump → tag → push → GitHub Release） | `/commit` `/git` `/release` |
| **任务看板** | Git 创作的 4 阶段任务流：提出 → 进行中 → 待审核 → 已完成 | Web 看板 / `/task-new` |
| **MCP** | 接入 MCP 服务器生态（浏览器、文件系统等），工具即插即用 | `~/.miro/agent/mcp.json` / `/mcp` |
| **浏览器自动化** | 基于 playwright-cli 的 token 高效浏览器操作 | playwright-cli 技能 |
| **计划模式 + 检查点** | 先计划后执行 + git 快照回滚 | `/plan` `/git_checkpoint` |
| **沙箱执行** | bwrap 轻量沙箱跑不可信命令 | `bash_sandbox` |
| **PR 审查** | 拉取 PR diff 并提交审查意见 | `pr_review` `pr_review_post` |

## 架构

Miro 自带一份**自维护的 Pi Agent fork**（`core/`，独立 git 仓库，保留上游 remote 定期同步）。白标（name=miro, configDir=.miro）直接内建于 fork 的 `piConfig`，不再需要安装时打补丁：

```
~/.miro/
├── bin/miro          # 启动器
├── core/             # 本地 Pi fork（从仓库 core/ 构建，npm run build:offline）
└── agent/            # Miro 家目录（会话、凭据、主题、插件）
    ├── AGENTS.md     # Miro 身份与行为准则
    ├── plugins/      # 声明式插件（plugin.json + commands/*.md + skills/*/SKILL.md）
    ├── memdir/       # 持久记忆（MEMORY.md 索引 + 记忆文件，异步相关预取）
    └── themes/       # miro-dark / miro-light / miro-opencode
```

**内核设计**（fork 内建，源自 Claude Code 的 5 个核心模式）：

| 设计 | 说明 | 位置（core/packages/coding-agent/src/core/） |
|---|---|---|
| **静态工具池** | 固定顺序工具注册表（内置 7 + Miro 26 个），模型 schema 唯一来源；扩展不再动态注册代码工具 | `tools/tool-pool.ts` |
| **分层权限管道** | fail-closed 决策：deny 规则 → 工具 checkPermissions → 内容级 `Tool(args)` → 受保护路径免疫 → allow → 默认读安全/写询问 | `permissions/permissions.ts` |
| **声明式插件** | 插件 = markdown（命令/技能），无可执行 JS；命令进模板池、技能进技能池 | `plugins/plugin-loader.ts` |
| **Prompt-cache 分段** | 系统提示词按静态核心/动态尾部边界拆块，静态段长缓存 | `system-prompt.ts` + ai `anthropic-messages.ts` |
| **预测式 autocompact** | 按下一轮预估增长（maxOutput+15K）提前压缩，避免 413 | `compaction/compaction.ts` |
| **memdir 记忆** | 索引 + 记忆文件 + turn 前异步相关预取，注入动态尾部 | `memory/memdir.ts` |
| **Subagent 隔离** | 子代理用 `--tools` 白名单替换父规则，审批不泄漏；`<task-notification>` 回传 | `builtin/miro-subagent-tool.ts` |
| **Dynamic Workflow** | vendored 确定性 JS 编排引擎（端口注入）；模型现场写脚本，**后台运行 + 进度 store/bus + 持久化/resume + /workflows 面板**；agent 级精确 kill | `vendor/workflow-engine/` + `workflow/` + `builtin/miro-workflow-tool.ts` |
| **Hook 系统** | 全量 27 事件；配置驱动 + 子进程执行（JSON stdin/stdout 协议）；PreToolUse 决策并入权限管道（allow 不绕过规则、deny 阻断、ask 强问、updatedInput 改写）；信任门禁防 RCE | `hooks/` |

> **开发说明**：`core/` 是 Pi monorepo 的 fork（分支 `miro/dev`），改动请在其内部提交；`install.sh` 会把它复制到 `~/.miro/core` 并离线构建。首次安装需要联网（npm 依赖 + 模型数据）。

## 安装

```bash
git clone https://github.com/HiddenKismet/miro-agent.git
cd miro-agent
./install.sh
```

> **core fork 说明**：`install.sh` 优先使用仓库内 `core/` 目录（Pi fork，分支 `miro/dev`）构建。`core/` 是独立 git 仓库（在 `.gitignore` 中），当前未包含在 GitHub 发布中——`install.sh` 检测到 `core/` 缺失时会尝试 `git clone --branch miro/dev https://github.com/earendil-works/pi.git`，但该分支尚未推送到上游，**fresh clone 安装暂不可用**（需要先在本地准备 `core/`，详见下方开发指南）。

运行：

```bash
~/.miro/bin/miro
# 或把 ~/.miro/bin 加入 PATH 后直接：
miro
```

## 开发指南（core fork）

内核是 `core/` 目录下的 Pi monorepo fork（分支 `miro/dev`，保留上游 remote 定期同步）。

```bash
# 1. 进入 fork 目录（独立 git 仓库）
cd core
git checkout miro/dev          # 已切换

# 2. 安装依赖（首次）与离线构建
npm ci --no-audit --no-fund
npm run build:offline

# 3. 改动后的检查链（pre-commit 也会跑）
npx biome check --write --unsafe <改动的文件>
cd packages/coding-agent && npx tsgo -p tsconfig.build.json --noEmit

# 4. 本地验证：白标 CLI + RPC 冒烟
cd packages/coding-agent
printf '{"type":"get_state","id":1}\n' | node dist/cli.js --mode rpc

# 5. 同步上游（miro/dev 分支）
git fetch origin && git merge origin/main

# 6. 把 fork 推送到你自己的 GitHub 仓库后，install.sh 的 fresh-clone 路径才会生效
```

内核改动集中在 `core/packages/coding-agent/src/core/`：

| 子系统 | 位置 |
|---|---|
| 静态工具池 | `tools/tool-pool.ts`、`tools/build-tool.ts` |
| 内置工具/命令/钩子 | `builtin/`（git、task、pr、sandbox、web、mcp、subagent） |
| 权限管道 | `permissions/permissions.ts`、`builtin/permission-guard.ts` |
| 声明式插件 | `plugins/plugin-loader.ts` |
| Prompt-cache 分段 | `system-prompt.ts`（+ `packages/ai/.../anthropic-messages.ts`） |
| 预测式 autocompact | `compaction/compaction.ts`、`agent-session.ts` |
| memdir 记忆 | `memory/memdir.ts` |

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `MIRO_HOME` | `~/.miro` | Miro 家目录 |
| `MIRO_PORT` | `5175` | Miro Web 端口 |
| `MIRO_AUTOWEB` | — | 设为 `1` 时启动即自动打开 Miro Web |
| `MIRO_WEB_TOKEN` | 自动生成 | Miro Web 访问令牌 |
| `MIRO_PROJECT` | `~/.miro/scratch` | TUI 启动时直接进入的项目目录（默认临时会话，跳过选择器） |
| `MIRO_PROJECTS` | — | 冒号分隔的项目扫描根目录（TUI 选择器自动发现项目） |

## 工作目录：默认临时会话，/project 进入项目

启动 Miro 默认进入**临时会话**（记录存到 `~/.miro/scratch`，与项目无关）。
需要进入具体项目时：

- **TUI**：输入 `/project` 打开项目选择器（模糊过滤 + 路径提示，↑↓/Enter 选择），
  或直接输入 `/project <路径>`——输入过程中实时弹出路径联想（已知项目模糊匹配 + 目录扫描，↑↓ 选择 · Tab 补全 · Enter 进入）；进入后自动重启并落在该项目目录
- **Web**：欢迎屏「进入项目」或 `/project` 命令，选择项目（或输入路径，手动输入框带实时路径联想）后重启引擎切换目录
- 启动时直进项目：`miro --project <路径>` 或 `MIRO_PROJECT=<路径>`
- `MIRO_PROJECTS`：冒号分隔的项目扫描根目录（选择器自动发现项目）

## 致谢

Miro 建立在 [**Pi Agent**](https://github.com/earendil-works/pi) 之上。由衷感谢 **Pi 项目及其作者（earendil-works）**：Miro 的白标化内核、RPC 协议、扩展体系与 TUI 基础都来自 Pi。没有 Pi，就没有 Miro。

## 许可证

MIT © HiddenKismet
