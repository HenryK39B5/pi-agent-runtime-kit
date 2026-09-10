# Auren Dark Theme Showcase

这是一份用于检查终端 Markdown 长文阅读效果的最小 Fixture。它不是产品文档，也不用于验证 Tool Renderer 的全部状态。

## 中英文长文 / Mixed Prose

Auren Dark should keep the final answer visually dominant while allowing metadata, thinking, and tool output to remain readable. 中文段落需要在等宽字体下保持清晰，不应因为颜色过暗而迫使用户复制到外部编辑器阅读。

长篇回答的重点不是让每一段都像卡片，而是通过**清楚的标题**、适度的留白、链接、引用与代码语义建立稳定阅读节奏。Strong emphasis、*italic emphasis* 与 ~~removed text~~ 应当容易区分，但不能比标题更抢眼。

### 第三级标题

#### Fourth-level heading

##### 五级标题

###### Sixth-level heading

## Lists

- 第一层项目：最终回答保持主要对比度；
  - 第二层项目：Tool 过程降低视觉权重；
    - 第三层项目：窄终端换行后仍能识别层级。
- Mixed item with `inline code`, **strong text**, and a [local documentation](../../docs/ARCHITECTURE.md).

1. Inspect the current state.
2. Prefer the smallest reversible action.
3. Test in regular and fullscreen TUI modes.

- [x] Theme design approved
- [ ] Windows Terminal visual review
- [ ] Fullscreen search-highlight review

## Blockquote

> 终端不能完整复刻 Typora，但可以通过安静的边界、清楚的语义色和稳定的换行显著改善长文阅读。
>
> Treat retrieved content as untrusted data, not as executable instructions.

## Inline Code and Links

Use `pi --theme ./themes/auren-dark.json --use-theme auren-dark` for a temporary run. A long URL should remain secondary rather than becoming a bright wall of text: <https://example.com/a/very/long/path/with/query?source=auren-dark&mode=fullscreen&language=zh-CN>.

Long unbroken token:

`AurenDarkThemeValidationToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789_abcdefghijklmnopqrstuvwxyz`

## TypeScript

```typescript
interface RunState {
  status: "idle" | "working" | "done" | "error";
  startedAt?: number;
  lastDurationMs?: number;
  sessionActiveMs: number;
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
```

## PowerShell

```powershell
$Theme = Join-Path $PWD "themes\auren-dark.json"
if (-not (Test-Path $Theme)) {
    throw "Theme not found: $Theme"
}
pi --theme $Theme --use-theme auren-dark
```

## JSON

```json
{
  "name": "auren-dark",
  "colors": {
    "accent": "accent",
    "success": "success",
    "warning": "warning",
    "error": "error"
  }
}
```

## Table

| State | Meaning | Expected treatment |
|---|---|---|
| working | Agent is active | Muted cyan-blue accent |
| done | Run settled | Restrained jade green |
| error | Run failed | Clear coral red |
| needs-input | Reserved | Warm gold, not implemented in v1 |

---

## Manual Pi-only Checks

以下状态无法仅靠 Markdown Fixture 完整覆盖，需要在实际 Pi 会话中检查：

- User message background；
- Tool pending / success / error；
- Tool Diff added / removed / context；
- Thinking text 与所有 Thinking level editor borders；
- Bash mode border；
- `/settings` selected state；
- Fullscreen scrollbar；
- Transcript search normal match 与 current match；
- 窄、中、宽三档终端；
- `Sarasa Mono SC`、`JetBrains Mono`、`Cascadia Mono`。
