# Pi Agent Runtime Kit

一套面向 [Pi](https://pi.dev/) 的公开、安全、轻量、可观察、可回滚的 Runtime DIY 参考实现。适合 Clone 到本地后交给 Agent，按本机环境和真实需求审查、选择、试运行，再部署。

本仓库**不是** Pi 官方项目、npm/Pi Package、一键安装器或私人 Runtime 的镜像。不会附带任何可直接使用的账户、Provider 目标、服务注册表、凭据或私人部署记录。

2026-10-02 当前源码/开发依赖基线为 **Pi 1.0.0**；本轮验证环境是 Windows 11、Node 24.13.1、PowerShell 与 Git Bash/Windows Node。Node 最低版本随依赖要求为 22.19.0，但本轮没有重新认证 Node 22。旧 0.85.1 为历史基线，不代表新源码仍兼容。验证范围见 [Compatibility](docs/COMPATIBILITY.md)，本次仅依赖/文档同步见 [Pi 1.0.0 update](docs/PI_1_0_0_UPDATE.md)。

## 包含哪些内容

### 本地优先

- **Auren Themes**：Dark、Forest、Ember、Violet 四套纯 JSON 深色主题；不修改字体。
- **Auren UI**：状态、Run/Session 计时、Title、Windows Terminal 进度、完成 Metadata、BEL；仅 working 期间一个 1 Hz Timer。
- **恢复计时**：优先正确绑定的记录、去重/分支/queued/steering 与无文本异常恢复；手动“继续”是新 Run，Session 保留旧 Run，不计空闲等待。
- **Context 缓存**：按 leaf/model 与生命周期失效，不每秒重复投影扫描。
- **Markdown 阅读适配**：修正中文标点紧邻简单强调的显示；保留原文、代码、链接与复杂/不完整片段，不替换原生 renderer。
- **Footer Status Protocol v1**：Auren 是唯一 Footer owner，其余模块只发布有界数据。
- **Safety Prompt**：行为策略与 Windows 原生工具链指导，不是 Sandbox。

### 默认关闭、需要明确配置

- **ntfy**：短消息或最多六次有界强提醒；测试消息明确标注测试，真实路由只在仓库外。
- **OpenAI Web Search**：主 Responses 请求级 hosted 声明/指导，完成响应的实际 URL annotations 用原生 Markdown 显示；目标列表为空。
- **Kiro helper 适配模板**：query-only 独立 hosted-search 辅助请求、严格边界/清洗/取消与来源链接；目标列表为空，不是通用 Claude/Kiro 兼容承诺。
- **官方 MCP 接法**：仅提供 disabled + invalid-domain 示例和发现/schema/auth 边界指导；不连接真实服务。
- **历史受约束 MCP 模板**：仍保留为非默认、需重新审查的旧模板，未认证其新基线 Runtime/OAuth。

两条搜索路线使用 `/openai-web` 与 `/kiro-web`，独立保存选择；Footer 仅当前支持路线显示 `web:openai` / `web:kiro` 或灰色 `web:off`。没有旧 Relay 命令/状态 fallback。开启、声明和 Footer 都不是实际搜索/事实核验的证明。

## 验证与安全试运行

开发依赖只安装在此 Clone：

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run validate:theme
npm run audit:public
```

`npm test` 在导入前隔离通知/三偏好/Agent 路径，默认阻止标准 Node 网络连接；真实模型、通知或 MCP 测试不混入离线入口。禁网护栏不是 OS Sandbox。

临时 UI 试运行请先遵循 [Adoption guide](docs/ADOPTION_GUIDE.md) 的隔离环境步骤，避免继承已有通知模式、路由或 MCP 连接。不要把整个仓库复制到全局配置。

## 让 Agent 协助移植

1. 读取 `AGENTS.md`、采用指导和安全边界；
2. 检查本机 Pi 版本及对应的完整本地文档；
3. 按需选择模块，识别同名命令、Footer 和 MCP 所有者；
4. 联网保持 off/未配置，明确评审 Provider 或服务器；
5. 跑仓库测试与有界临时验证；
6. 展示拟修改的全局 diff、备份及回滚；
7. 用户明确批准后部署，发布/Push 另行授权。

> 请先阅读本仓库的 AGENTS.md 与 docs/ADOPTION_GUIDE.md，核对我本机 Pi 版本及相关文档。选择最小模块，先展示临时试运行、全局 Diff 和回滚方案；未经确认，不修改全局、发送通知、连接 MCP、执行 Provider 测试或发布。

## 结构

```text
extensions/auren-ui/          本地 UI、计时、缓存、Markdown 与可选 ntfy
extensions/openai-web-search/ 主请求 hosted 搜索与 display-only 来源
extensions/kiro-web-search/   默认未配置的独立 helper 协议适配
extensions/constrained-mcp/   历史非默认模板，不可直接运行
themes/                      四套纯 JSON Theme
prompts/                     通用 Safety 与 Shell Policy
examples/                    空目标/无效域名/disabled 配置形状
docs/                        采用、架构、安全、兼容性与本轮边界
scripts/                     隔离测试、Theme 与公开树检查
tests/                       纯规则/原生组件/SDK 合成回归
```

## 重要边界

- Extension 与 Pi 同用户权限；Prompt 不是强制权限门。
- Helper 和 MCP/ntfy 启用后可向外部传数据，失败/取消仍可能计费。
- 来源摘要不是完整页面，也不是事实认证；URL 清洗不是完整 DLP。
- 来源/完成记录不进入模型上下文，但仍属于本地 Session 状态，不应提交。
- 官方 MCP 的连接/重连与进程生命周期不是零成本；OAuth 和远程写入需要明确意图。
- 旧 `/mcp` Wrapper 会替换原生 session MCP，不应盲目混用。
- 不承诺未来版本、平台或网关的兼容性，也不自动安装、升级、部署或发布。

详见 [Security boundaries](docs/SECURITY_BOUNDARIES.md)、[Native MCP](docs/NATIVE_MCP.md) 和 [本轮清洗范围](docs/MAINTENANCE_UPDATE.md)。

## License

MIT。第三方依赖遵循各自 License；不复制依赖源码或提交 node_modules。
