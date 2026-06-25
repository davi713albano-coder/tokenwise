<div align="center">

<!-- omit in toc -->

# tokenwise

**Find out where your AI coding agent burns tokens.**

Cross-agent token waste analytics + automated fixes.

[![npm version](https://img.shields.io/npm/v/tokenwise?color=brightgreen&label=npm)](https://www.npmjs.com/package/tokenwise)
[![install size](https://packagephobia.now.sh/badge?p=tokenwise)](https://packagephobia.now.sh/result?p=tokenwise)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/tokenwise?label=node%20%3E%3D18)](https://nodejs.org/)

```bash
npx tokenwise audit    # trim instruction files
npx tokenwise scan     # analyze session logs
```

</div>

---

<!-- omit in toc -->

## The problem

You're paying **$500+/month** in AI coding agent API costs. Half those tokens are waste:

- Boilerplate instructions the model already follows ("Always write clean code")
- ALL-CAPS emphasis that doesn't make the model obey better
- Duplicate sections across CLAUDE.md files
- Rules that load on every message instead of when relevant
- Session history that balloons until you /compact

**You can't optimize what you can't measure.** That's tokenwise.

---

<!-- omit in toc -->

## Quick start

```bash
# No install needed
npx tokenwise audit
npx tokenwise scan

# Or install globally
npm i -g tokenwise
tokenwise audit
tokenwise scan
```

---

<!-- omit in toc -->

## What it does

### `tokenwise audit` — Trim instruction file waste

Scans your instruction files and shows exactly where tokens are burning:

```
┌──────────────────────┬────────┬───────┬───────────┬────────────────────┬─────────┐
│ File                 │ Tokens │ Lines │ Load Freq │ Flags              │ Savings │
├──────────────────────┼────────┼───────┼───────────┼────────────────────┼─────────┤
│ CLAUDE.md            │  2,341 │    87 │ EVERY MSG │ boilerplate, ...  │    -891 │
│ .claude/rules/api.md │    412 │    15 │ EVERY MSG │ unscoped_rule      │    -243 │
│ .claude/rules/db.md  │    198 │     9 │ on demand │ ok                 │       - │
└──────────────────────┴────────┴───────┴───────────┴────────────────────┴─────────┘
```

**8 heuristics, zero LLM calls, zero API keys:**

| Heuristic | What it catches | Fix |
|---|---|---|
| `excessive_length` | >200 lines | Split into scoped rule files |
| `high_boilerplate` | >25% generic advice ("write clean code") | Remove — model already knows |
| `excessive_emphasis` | NEVER/ALWAYS/MUST/CRITICAL spam | De-shoutify to normal tone |
| `duplicate_section` | >60% Jaccard similarity between sections | Merge or remove duplicate |
| `unscoped_rule` | .claude/rules/ without `paths:` frontmatter | Add `paths:` to scope loading |
| `redundant_with_config` | Instruction already in tsconfig/.prettierrc | Remove — config enforces it |
| `obvious_description` | "src/ contains source code" | Remove — model can discover this |
| `empty_section` | `## Architecture` with no body | Fill or remove |

**Auto-fix with `--fix`:**

```bash
tokenwise audit --fix
```

Creates `.bak` backups. Never deletes content. Only safe transforms:
- De-boilerplate (remove generic advice lines)
- De-shoutify (NEVER → Never)
- Deduplicate sections
- Remove empty sections
- Add `paths:` stub to unscoped rules

### `tokenwise scan` — Analyze session token usage

Reads your latest Claude Code / OpenCode session and shows where tokens went:

```
┌─────────────────────────┬─────────┬────────────┬───────────┐
│ Component               │  Tokens  │ % of Input │ Est. Cost │
├─────────────────────────┼─────────┼────────────┼───────────┤
│ System Prompt           │   1,413 │       0.3% │     $0.00 │
│ History/Context         │ 205,889 │      38.4% │     $0.62 │
│ Tool Output             │       0 │       0.0% │         - │
│ Cache Hits (discounted) │ 120,704 │      22.5% │     $0.04 │
└─────────────────────────┴─────────┴────────────┴───────────┘

  Top token hogs
  1. History/Context — 205,889 tokens
     Use /compact more frequently to prune conversation history.
  2. Cache Hits — 120,704 tokens
     Good — cache reads cost 90% less. Keep static content early.
  3. System Prompt — 1,413 tokens
     Run `tokenwise audit` to trim instruction files.

  Cost estimate
  This session:      $1.37
  Monthly (22 days): $1,511.57
```

**Key metrics:**
- **Cache hit rate** — are your prompts cache-friendly? (target: >50%)
- **Token hogs** — top 3 consumers with actionable tips
- **Cost projection** — per-session and monthly at Sonnet/Haiku/Opus pricing

---

<!-- omit in toc -->

## Supported agents

| Agent | Audit | Scan | Config |
|---|---|---|---|
| **Claude Code** | CLAUDE.md, .claude/rules/ | ~/.claude/projects/ JSONL | Anthropic pricing |
| **OpenCode** | AGENTS.md, .opencode/ | opencode.db SQLite | Anthropic pricing |
| **Cursor** | .cursorrules | — | — |

---

<!-- omit in toc -->

## CLI reference

### `tokenwise audit`

```
Options:
  --dir <path>     Project directory (default: cwd)
  --fix            Auto-fix safe issues (creates .bak backups)
  --json           Raw JSON output (for scripts/piping)
  --model <model>  Cost model: sonnet (default), haiku, opus
  --verbose        Show per-flag details with line numbers
```

### `tokenwise scan`

```
Options:
  --session <path>  Path to specific session file
  --db <path>       Path to OpenCode database
  --json            Raw JSON output (for scripts/piping)
  --model <model>   Cost model: sonnet (default), haiku, opus
```

---

<!-- omit in toc -->

## How it works

- **Token counting**: `js-tiktoken` with `o200k_base` encoding (~10% variance from Anthropic's proprietary tokenizer — sufficient for budget estimation)
- **Similarity detection**: Shingling (k=5) + Jaccard coefficient — no LLM, no API, no data leaves your machine
- **Cost estimation**: Hardcoded pricing (Sonnet $3/$15/M, Haiku $0.8/$4/M, Opus $15/$75/M)
- **SQLite reading**: `sql.js` (pure JS/WASM, zero native dependencies)
- **All local, all offline** — zero API calls, zero LLM inference

---

<!-- omit in toc -->

## Real examples

<details>
<summary><strong>audit output</strong></summary>

```
$ tokenwise audit --dir ~/my-project

  tokenwise audit — instruction file analysis

┌──────────────────────┬────────┬───────┬───────────┬──────────────────────────────┬─────────┐
│ File                 │ Tokens │ Lines │ Load Freq │ Flags                        │ Savings │
├──────────────────────┼────────┼───────┼───────────┼──────────────────────────────┼─────────┤
│ CLAUDE.md            │  2,341 │    87 │ EVERY MSG │ high_boilerplate, ...        │    -891 │
│ .claude/rules/api.md │    412 │    15 │ EVERY MSG │ unscoped_rule                │    -243 │
│ .claude/rules/db.md  │    198 │     9 │ on demand │ ok                           │       - │
└──────────────────────┴────────┴───────┴───────────┴──────────────────────────────┴─────────┘

  Summary
  Total tokens in instruction files:    2,951
  Reducible tokens:                    1,134 (38.4% reducible)
  Est. monthly cost (sonnet):          $4.43
  Est. monthly savings:               $1.70

  Run tokenwise audit --fix to auto-fix safe issues.
```

</details>

<details>
<summary><strong>scan output</strong></summary>

```
$ tokenwise scan --model opus

  tokenwise scan — session token analysis

  Source:     opencode
  Session:   ses_abc123
  Date:      2026-06-25
  Model:     claude-sonnet-4-20250514
  Messages:  24

┌─────────────────────────┬─────────┬────────────┬───────────┐
│ Component               │  Tokens │ % of Input │ Est. Cost │
├─────────────────────────┼─────────┼────────────┼───────────┤
│ System Prompt           │   1,413 │       0.3% │     $0.02 │
│ History/Context         │ 205,889 │      38.4% │     $3.09 │
│ Tool Output             │       0 │       0.0% │         - │
│ Reasoning               │       0 │       0.0% │         - │
│ Cache Hits (discounted) │ 120,704 │      22.5% │     $0.18 │
└─────────────────────────┴─────────┴────────────┴───────────┘

  Cost estimate
  This session:      $6.83
  Monthly (22 days): $7,513.00
```

</details>

<details>
<summary><strong>JSON output</strong></summary>

```bash
$ tokenwise audit --json | jq '.files[0].flags'
```

```json
[
  {
    "id": "high_boilerplate",
    "severity": "medium",
    "message": "3 boilerplate lines (20% of non-header content). AI already knows these defaults.",
    "savings": 89
  },
  {
    "id": "unscoped_rule",
    "severity": "high",
    "message": "Rule has no YAML frontmatter. Add --- with paths: to scope loading.",
    "savings": 243
  }
]
```

</details>

---

<!-- omit in toc -->

## Why tokenwise?

| | tokenwise | Manual review | LLM-based tools |
|---|---|---|---|
| **Cost** | Free, local | Your time | $0.01-0.05/analysis |
| **Speed** | <1s | Minutes | 2-5s per file |
| **Reproducible** | Always | Varies by reviewer | Non-deterministic |
| **Privacy** | 100% local | Local | Sends content to API |
| **CI-friendly** | `--json` exit codes | No | Maybe |

---

<!-- omit in toc -->

## Roadmap

- [ ] **v0.2** — Cursor rules support, `.cursorrules` audit
- [ ] **v0.3** — Pre-commit hook integration (`tokenwise audit --ci`)
- [ ] **v0.4** — Live watch mode with cost ticker
- [ ] **v0.5** — MCP server for agent self-audit
- [ ] **v0.6** — Compact-config generator (auto-generate optimal /compact prompts)

---

<!-- omit in toc -->

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

<!-- omit in toc -->

## License

[MIT](./LICENSE) — built with :fire: by the community, for the community.
