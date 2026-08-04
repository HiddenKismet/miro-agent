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

Miro 不是扩展集合，而是自带一份**白标化的 Pi Agent 引擎**：

```
~/.miro/
├── bin/miro          # 启动器
├── core/             # 本地 Pi Agent 引擎副本（经官方 piConfig 白标）
└── agent/            # Miro 家目录（会话、凭据、主题、扩展）
    ├── AGENTS.md     # Miro 身份与行为准则
    ├── extensions/   # miro-web、miro-brand、auto-task-resume、miro-git、miro-task
    └── themes/       # miro-dark / miro-light / miro-opencode
```

## 安装

```bash
git clone https://github.com/HiddenKismet/miro-agent.git
cd miro-agent
./install.sh
```

运行：

```bash
~/.miro/bin/miro
# 或把 ~/.miro/bin 加入 PATH 后直接：
miro
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `MIRO_HOME` | `~/.miro` | Miro 家目录 |
| `MIRO_PORT` | `5175` | Miro Web 端口 |
| `MIRO_AUTOWEB` | — | 设为 `1` 时启动即自动打开 Miro Web |
| `MIRO_WEB_TOKEN` | 自动生成 | Miro Web 访问令牌 |
| `MIRO_PROJECT` | — | TUI 启动时直接进入的项目目录（跳过启动选择器） |
| `MIRO_PROJECTS` | — | 冒号分隔的项目扫描根目录（TUI 选择器自动发现项目） |

## 启动即选择工作目录

启动 Miro 时可选择会话落在哪里（类似 Codex 桌面端）：

- **临时会话**：记录存到 `~/.miro/scratch`，与项目无关
- **进入项目**：会话与 git 操作都落在所选项目目录（列出最近项目 + 手动输入路径）

TUI 用 `↑↓/Enter` 选择；也可用 `miro --project <路径>` 或 `MIRO_PROJECT=<路径>` 跳过选择器。
Web 欢迎屏提供「临时会话 / 进入项目」两个入口，切换会重启引擎并换到目标目录。

## 致谢

Miro 建立在 [**Pi Agent**](https://github.com/earendil-works/pi) 之上。由衷感谢 **Pi 项目及其作者（earendil-works）**：Miro 的白标化内核、RPC 协议、扩展体系与 TUI 基础都来自 Pi。没有 Pi，就没有 Miro。

## 许可证

MIT © HiddenKismet
