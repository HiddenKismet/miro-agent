---
name: miro-workflow
description: 用 workflow 工具编排多子代理的确定性 JS 脚本（何时用、原语速查、确定性约束、示例）。当任务需要大规模并行 fan-out、多视角审查、或结构化验证时调用。
---

# Miro Dynamic Workflow 编排手册

用 `workflow` 工具执行**确定性 JS 编排脚本**。脚本在沙箱中运行，每个 `agent()` 调用会拉起一个隔离的子代理进程。

## 何时使用 workflow

- **单上下文装不下的大任务**：迁移、审计、批量 sweep、大 diff 多维度审查
- **需要多视角置信度**：并行调研 + 对抗式验证
- **需要结构化输出**：让子代理按 JSON Schema 返回，引擎侧校验
- 简单任务直接做即可；workflow 是给"编排本身有价值"的场景

## 编排原语（脚本内注入，不是全局）

```js
// 单个子代理（可选 label/phase/schema/allowedTools/model）
const r = await agent('审查这段代码找 bug', { label: 'review:bugs', phase: 'Review' })

// 并行 fan-out（barrier：全部完成后继续；单项失败返回 null 不中断）
const rs = await parallel([
  () => agent('角度1'),
  () => agent('角度2'),
])

// 流水线（无 barrier，每项独立过 stage）
const out = await pipeline(items, item => agent('处理 ' + item))

// 进度分组与日志
phase('Review')
log('开始审查')

// 嵌套子 workflow（仅一层）
const sub = await workflow('sub-workflow', { someArg: 1 })

// 读取调用参数
const a = args // 调用时传入的任意 JSON 值
```

## 确定性硬约束（违反直接报错）

- **禁止 `import` / 动态 `import()`**
- **禁止 `Date.now()` / `Math.random()` / 无参 `new Date()`**（引擎会拦截，保证可重放）
- 只能有一处 `export const meta = { name, description, whenToUse?, phases? }`（纯字面量）
- 用顶层 `return` 返回结果

## 示例

```js
export const meta = {
  name: 'review-changes',
  description: '按维度审查改动并对抗式验证',
  whenToUse: '审查大 diff / 需要多视角验证时',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const DIMENSIONS = [
  { key: 'bugs', prompt: '找正确性 bug' },
  { key: 'perf', prompt: '找性能问题' },
]

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review' }),
  review => agent(`对抗式验证：${review}`, { phase: 'Verify' }),
)
return results
```

## 结构化输出

给 `agent()` 传 `schema`（JSON Schema 对象），子代理会被要求输出匹配的 JSON，引擎会用 Ajv 校验；不匹配则该 agent 记为失败（返回 null）。

## 调用方式

- **现场写脚本**：`workflow { script: "..." }`（模型运行时动态编排）
- **命名 workflow**：`workflow { name: "xxx" }` 引用 `~/.miro/agent/workflows/xxx.js`；也可用 `/<name>` 命令直接跑
- **脚本文件**：`workflow { scriptPath: "/abs/path.js" }`
- `maxConcurrency` 控制并发上限（默认 3，最大 16）

## 隔离与安全

- 子代理是独立进程（`--no-session` 不持久化），只拿到 `allowedTools` 白名单里的工具
- `workflow` 和 `subagent` 工具在子代理内被禁用（防递归）
- 脚本无法访问文件系统/网络——那是子代理工具的事
