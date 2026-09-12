# Pi Agent Runtime Kit

一套面向 [Pi](https://pi.dev/) 的公开、安全、轻量、可观察、可回滚的 Runtime DIY 参考实现。它适合 Clone 到本地后，连同相关文章或你自己的需求一起交给 Agent，由 Agent 检查本机环境并协助移植。

本仓库**不是** Pi 官方项目、npm/Pi Package、持续维护的发行版或一键安装器。它的定位是 Agent-assisted adoption kit：先理解、选择和试运行，再部署真正需要的模块。

已验证基线：**Pi 0.85.1**、Node.js 22/24、Windows 11、Windows Terminal 与 PowerShell。其他版本和平台可能可用，但必须结合本机安装版本的 Pi 文档重新检查。

## 包含哪些内容

### 本地优先的核心功能

- **Auren Themes**：四套共享语义结构的深色主题——冷静 Azure 的 Dark、自然 Sage/Jade 的 Forest、温暖 Copper/Amber 的 Ember，以及暮色 Lavender 的 Violet。
- **Auren UI**：`idle / working / done / error` 状态、Run 计时、Session 估算、Terminal Title、Windows Terminal 进度、完成 Metadata 与 BEL 提醒。
- **Footer Status Protocol v1**：Footer 只有一个 Renderer 所有者，其他 Extension 通过 `pi.events` 发布经过约束的数据型状态。
- **Runtime Preferences**：小型、版本化、原子替换的 JSON 状态；读取异常时 fail-safe 为 `off`。
- **Safety Prompt**：简短的行为策略与 Windows 原生工具链规则。它不是 Sandbox。

### 默认关闭的可选功能

- **ntfy 通知**：发送一次普通通知，或最多六次有界强提醒；真实路由始终留在仓库外部。
- **Relay Search**：只为人工确认的 OpenAI Responses Provider/Model 追加托管 `web_search` 声明；公开目标列表故意保持为空。
- **Constrained MCP 模板**：固定 Registry、关闭高能力表面并精确锁定 `pi-mcp-adapter`；所有示例地址均为不可访问的保留域名。

## 安全试运行

首先安装仅用于测试的开发依赖：

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run validate:theme
npm run audit:public
```

在不修改全局 Pi 配置的情况下，临时试用 Auren UI 与 Theme（将 `auren-dark` 替换为 `auren-forest`、`auren-ember` 或 `auren-violet` 即可切换）：

```powershell
pi `
  --no-extensions `
  --no-themes `
  --theme ./themes/auren-dark.json `
  --use-theme auren-dark `
  --tui-mode fullscreen `
  -e ./extensions/auren-ui/index.ts
```

`--no-extensions` 可以防止已经安装的 UI Extension 与当前源码同时接管 Footer；显式指定的 `-e` 仍然会加载。

## 让 Agent 协助移植

让 Agent 先读取 `AGENTS.md`，再读取 `docs/ADOPTION_GUIDE.md`。推荐流程是：

1. 检查本机 Pi 版本和对应的本地文档；
2. 按需选择模块，而不是默认安装全部内容；
3. 识别操作系统、Terminal、Shell 与目标配置目录；
4. 在配置完成前保持所有联网模块关闭；
5. 运行仓库测试和临时 Pi Smoke Test；
6. 展示拟修改的全局 Diff、备份位置和回滚方法；
7. 获得用户明确确认后再部署。

可以直接使用下面的起始要求：

> 请先阅读这个仓库的 `AGENTS.md` 与 `docs/ADOPTION_GUIDE.md`，检查我本机安装的 Pi 版本和对应文档。根据我的系统选择最小模块，先给出临时试运行、全局修改 Diff 和回滚方案；未经我确认，不要修改全局配置、发送通知、连接 MCP 或执行发布操作。

## 仓库结构

```text
extensions/auren-ui/          本地 UI、计时、Footer、BEL 与可选 ntfy
extensions/relay-search/      Provider 托管搜索声明实验
extensions/constrained-mcp/   不可直接运行的受约束 Registry 模板
themes/auren-*.json           四套 Auren Theme source of truth
prompts/APPEND_SYSTEM.md       通用 Safety 与 Shell Policy
examples/                     不包含秘密的配置示例
docs/                         采用流程、架构、安全和兼容性说明
scripts/                      测试与公开树检查
tests/                        纯函数和模拟生命周期回归测试
```

## 重要边界

- Pi Extension 与 Pi 进程拥有相同的用户权限。
- Prompt Policy 只能引导行为，不能强制实现工具安全。
- ntfy 和 MCP 可能向外部服务传输数据。
- Relay Search 依赖 Provider 行为，追加声明不代表搜索一定发生；Pi 0.85.1 还可能丢失 Hosted Search Event 和结构化 Citation。
- Completion Metadata 与 Preference 文件属于本地 Runtime 状态，不应提交。
- Constrained MCP 示例不会读取任意项目或宿主 MCP 配置。
- 本仓库不承诺维护周期，也不承诺兼容未来 Pi 版本。

启用任何联网模块前，请先阅读 `docs/SECURITY_BOUNDARIES.md`。

## License

MIT。第三方依赖继续遵循各自 License；本仓库不复制依赖源码，也不提交 `node_modules`。
