# Miro Personal Agent

> 让 Miro 梳理你的思绪 · *Let Miro sort your mind*

**Miro 是基于 Pi Agent 二次定制开发的私人智能代理。**
专注承接个人碎片化思考、资料整理、任务规划、多场景推理，作为专属数字化幕僚。

Miro 源自拉丁语「miror」，意为观察、探寻、洞察。
作为你的专属个人 Agent：持续捕捉碎片化信息、推演思考、梳理任务；
调性轻盈年轻化，没有冰冷工业感。

## 内置能力（原生，无需安装扩展）

| 能力 | 说明 | 入口 |
|---|---|---|
| **Miro Web** | 浏览器界面：聊天、目标、任务工作流、凭据、会话管理 | `/web` 或让 Miro 自己打开 |
| **Subagents** | 子代理并行/串行协作 | `/run` `/parallel` 等 |
| **Tasks** | 工作流任务 + 重启自动续跑 | `/task` |
| **Goal** | 目标 + 列表 + 审计 + 循环优化 | `/goal` `/list` `/loop` |

## TUI：OpenCode 风格

- 近黑底色 + 薄荷青强调（`miro-opencode` 主题）
- 双行 footer：`路径:分支` + 快捷键提示
- 编辑器上方信息条：token / 成本 / 模型
- `■` 进度式工作指示器 + `✦ Miro` 常驻状态

## 架构：深度白标（原生内核）

Miro 不是扩展集合，而是自带一份**白标化的 Pi Agent 引擎**：

```
~/.miro/
├── bin/miro          # 启动器
├── core/             # 本地 Pi Agent 引擎副本（经官方 piConfig 白标）
│                     #   标题栏/头部/环境变量全部显示 "miro"
└── agent/            # Miro 家目录（会话、凭据、主题、扩展）
    ├── AGENTS.md     # Miro 身份与行为准则
    ├── extensions/   # miro-web、miro-brand、auto-task-resume
    └── themes/       # miro-dark / miro-light（薄荷青）
```

全局的 pi 完全不受影响；两者可并存。

## 安装

```bash
git clone https://github.com/HiddenKismet/miro-agent.git
cd miro-agent
./install.sh
```

安装器会：

- 安装 Miro 专属 Pi Agent 引擎副本到 `~/.miro/core/`（约 160MB）
- 通过官方 `piConfig` 钩子白标引擎（TUI 标题、头部、`MIRO_*` 环境变量）
- 创建 `~/.miro/agent/` 家目录（与 Pi 完全隔离）
- 内置 miro-web、任务自动续跑、Miro 品牌钩子、薄荷青主题
- 配置 packages：subagents、pi-task、goal(glla)
- 首次安装时从 `~/.pi/agent/auth.json` 继承凭据（如存在）

然后运行：

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

例：`MIRO_AUTOWEB=1 miro` —— 启动即弹出浏览器界面。

## 命名规范

- 项目文件夹：`miro-agent`
- 包名/模块：`miro`
- 环境变量前缀：`MIRO_`
- 可执行文件：`miro`

> 注意：有知名在线白板工具同名 Miro。对外完整署名 **Miro Personal Agent**，
> 代码仓库与内部代号统一小写 `miro-agent`。

## 标语备选

1. Miro｜你的私人思考代理
2. Miro，洞察零散想法
3. Let Miro sort your mind
