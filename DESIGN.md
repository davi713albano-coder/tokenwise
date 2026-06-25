# tokenwise v0.1 — Design Doc

**One-liner:** Cross-agent token waste analytics + automated fixes for AI coding agents.

**Core loop:** `tokenwise audit` → "oh shit" moment → `tokenwise scan` → "it keeps happening" → fix → verify savings.

## The Problem

AI coding agents waste tokens at industrial scale. The data is clear:

- ~$13/developer/active day on Claude Code (Anthropic enterprise figures)
- Power users hit $500–$2,000/month (Morph research)
- A 6-person team at Branch8 spent $2,400 in month 1, cut to $680 after optimization — a 72% drop
- Microsoft reportedly canceled Claude Code licenses for its Experiences+Devices division in June 2026, citing ~$2,000/engineer/month
- A Stanford 2025 study found developers waste thousands of tokens daily from unchecked context limits
- Just saying "hi" in Claude Code consumes ~31,000 tokens (GitHub issue #52979)

### Where Tokens Are Wasted

1. **Context bloat** — Input tokens dwarf output tokens. One session: 892K input vs 12K output. Agents re-read 80,000 tokens of context every invocation.
2. **CLAUDE.md / AGENTS.md loads on EVERY message** — A 3,847-token CLAUDE.md vs a 312-token version: 91.9% reduction with NO quality regression. On $500/month spend = ~$460 saved per month from editing ONE file.
3. **Rules files load always** — Adding `paths:` frontmatter reduces always-loaded rules from 1,358 to 807 lines: 41% overhead reduction.
4. **MCP servers are a silent tax** — Every connected MCP server loads its tool schema into EVERY request. 10,000–20,000 tokens per session per server. `ENABLE_TOOL_SEARCH` defers schemas: 50,000–70,000 tokens saved.
5. **Tool output noise** — Build logs, test output, bash command output flood context. A PostToolUse hook compressing 10,000-line build log to 200-line error summary = 80-99% reduction.
6. **Loading full files when only 1 function needed** — A 500-line file costs ~375 tokens; one function ~40 tokens (89% reduction). Tree-sitter AST tools solve this.
7. **Full codebase exploration instead of graph queries** — "what calls ProcessOrder?" via code knowledge graph: ~200 tokens vs reading 10 files: ~15,000 tokens (99.2% reduction).
8. **Prompt caching not used correctly** — Cache reads cost 10% of standard input price = 90% reduction. Common mistakes: whitespace differences, tool reordering, TTL expiry, changing system prompt order.
9. **Skills architecture bloat** — Loading all skills at once vs demand-based loading. Progressive skill disclosure: 15,000 tokens recovered per session, 82% improvement.
10. **No built-in token visibility** — Users can't see what's burning their tokens.

### Competitive Landscape

| Tool | What it does | Gap |
|------|-------------|-----|
| opencode-quota | Shows token usage | No optimization |
| OpenCode DCP | Context pruning for OpenCode | Development slowed, OpenCode only |
| Sleev CLI | Local proxy, context management | Closed/limited |
| RTK (rtk-ai) | Rust proxy, compresses bash output | Bash only |
| AFT (Zireael/aft) | Tree-sitter AST tools | Code navigation only |
| codebase-memory-mcp | Code knowledge graph via MCP | MCP only, setup heavy |
| Morph Compact | Deletes irrelevant lines at 33k tok/s | Paid product |
| prompt-caching.ai | MCP plugin for cache breakpoints | Single technique |

**THE GAP:** No unified, open source tool that combines ALL of these optimizations into one CLI + skill that works across ALL agents.

## Core Principle

Most tools truncate (makes AI dumber). tokenwise compresses SEMANTICALLY (AI gets smaller but smarter context).

**The moat is measurement, not compression.** Every optimization is replicable; the compound analytics view across agents is not.

## v0.1 Scope (2 commands)

| Command | What it does | Output |
|---------|-------------|--------|
| `tokenwise audit` | Scans CLAUDE.md, AGENTS.md, .claude/rules/, .opencode/ — counts tokens, flags redundancy, generates minimal replacements | Before/after table + diff + token count |
| `tokenwise scan` | Reads latest session JSONL/log, breaks down token usage by component (system prompt %, history %, tool output %, code %) | Pie chart in terminal + top 3 hogs |

### What v0.1 does NOT include (intentionally)

- No hooks (v0.2)
- No MCP audit (v0.2)
- No proxy/intercept (ever — use hooks instead)
- No /compact-config generator (v0.3)
- No live watch mode (v0.3)

## Stack

- TypeScript/Node.js
- tiktoken for token counting
- No LLM inference cost (all local computation)
- MIT licensed

## Cross-Agent Strategy

Parse session logs from Claude Code, OpenCode, Cursor. Each agent's log format is different but the breakdown (system prompt, history, tools, code) is universal. Ship Claude Code support first (most detailed JSONL logs), add OpenCode second.

## Risk

Agent vendors add measurement natively. Mitigation: no single vendor will measure across agents, and open source moves faster than proprietary analytics.

## First Users

1. **Team leads with $2,400/month Claude Code bills** — Authority to install, budget pain, team to influence. One audit showing "$1,740/month in recoverable waste" closes it.
2. **Solo devs paying API bills from their own pocket** — Feel every dollar. Free CLI that shows "edit this file, save $460/month" is a no-brainer. Loudest advocates on Twitter/HN.
3. **OpenCode / gstack skill authors** — Wrong first user. Too few. Treat as design partners, not a market.
