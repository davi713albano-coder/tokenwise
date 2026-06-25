<div align="center">

<!-- omit in toc -->

# tokenwise

**Find out where your AI coding agent burns tokens.**

Cross-agent token waste analytics + automated fixes.

[![npm](https://img.shields.io/npm/v/@davizin713/tokenwise)](https://www.npmjs.com/package/@davizin713/tokenwise)
[![npm version](https://img.shields.io/npm/v/tokenwise?color=brightgreen&label=npm)](https://www.npmjs.com/package/tokenwise)
[![install size](https://packagephobia.now.sh/badge?p=tokenwise)](https://packagephobia.now.sh/result?p=tokenwise)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/tokenwise?label=node%20%3E%3D18)](https://nodejs.org/)
[![GitHub stars](https://img.shields.io/github/stars/davi713albano-coder/tokenwise?style=social)](https://github.com/davi713albano-coder/tokenwise)
[![GitHub issues](https://img.shields.io/github/issues/davi713albano-coder/tokenwise)](https://github.com/davi713albano-coder/tokenwise/issues)
[![CI ready](https://img.shields.io/badge/CI-ready-brightgreen)](https://github.com/davi713albano-coder/tokenwise)

```bash
npx @davizin713/tokenwise audit    # trim instruction files
npx @davizin713/tokenwise scan     # analyze session logs
npx @davizin713/tokenwise watch    # live cost ticker
npx @davizin713/tokenwise report   # HTML savings report
npx @davizin713/tokenwise history  # session trends
npx @davizin713/tokenwise compare  # before/after savings
npx @davizin713/tokenwise ci       # CI/CD integration
npx @davizin713/tokenwise init     # setup wizard
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
npx @davizin713/tokenwise audit
npx @davizin713/tokenwise scan

# Or install globally
npm i -g @davizin713/tokenwise
tokenwise audit
tokenwise scan

# First time? Run the setup wizard
npx @davizin713/tokenwise init
```

---

<!-- omit in toc -->

## What it does

### `tokenwise audit` — Trim instruction file waste

Scans your instruction files and shows exactly where tokens are burning:

```
┌──────────────────────┬────────┬───────┬───────────┬────────────────────┬─────────┐
│ Severity │ File                 │ Tokens │ Lines │ Load Freq │ Flags              │ Savings │
├──────────┼──────────────────────┼────────┼───────┼───────────┼────────────────────┼─────────┤
│ HIGH     │ CLAUDE.md            │  2,341 │    87 │ EVERY MSG │ boilerplate, ...   │    -891 │
│ MED      │ .claude/rules/api.md │    412 │    15 │ EVERY MSG │ unscoped_rule      │    -243 │
│ LOW      │ .claude/rules/db.md  │    198 │     9 │ on demand │ ok                 │       - │
└──────────┴──────────────────────┴────────┴───────┴───────────┴────────────────────┴─────────┘
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

**Severity scores:** LOW / MEDIUM / HIGH / CRITICAL per file. **Quick win** highlight: single change with biggest savings.

**Auto-fix with `--fix`:**

```bash
tokenwise audit --fix
tokenwise audit --threshold 1000 --verbose
tokenwise audit --ignore ".cursorrules" --output report.txt
```

Creates `.bak` backups. Never deletes content. Only safe transforms:
- De-boilerplate (remove generic advice lines)
- De-shoutify (NEVER → Never)
- Deduplicate sections
- Remove empty sections
- Add `paths:` stub to unscoped rules

### `tokenwise scan` — Analyze session token usage

Reads your latest AI coding agent session (Claude Code, OpenCode, Aider, Cline, Codex CLI, Goose, Continue.dev) and shows where tokens went:

```
┌─────────────────────────┬─────────┬────────────┬───────────┐
│ Component               │  Tokens │ % of Input │ Est. Cost │
├─────────────────────────┼─────────┼────────────┼───────────┤
│ System Prompt           │   1,413 │       0.3% │     $0.00 │
│ History/Context         │ 205,889 │      38.4% │     $0.62 │
│ Tool Output             │       0 │       0.0% │         - │
│ Cache Hits (discounted) │ 120,704 │      22.5% │     $0.04 │
└─────────────────────────┴─────────┴────────────┴───────────┘
```

**Key metrics:**
- **Cache hit rate** — are your prompts cache-friendly? (target: >50%)
- **Token hogs** — top 3 consumers with actionable tips
- **Cost projection** — per-session and monthly across 7 pricing models
- **Cost alert** — warns when session exceeds your average

```bash
tokenwise scan --agent auto      # auto-detect best available agent
tokenwise scan --all             # scan ALL sessions
tokenwise scan --since 2026-06-01  # sessions since a date
tokenwise scan --detect          # list detected agents
```

### `tokenwise watch` — Live cost ticker

Real-time dashboard that updates every 2 seconds as your AI agent works:

```
┌─ tokenwise watch ─────────────────────────────────┐
│ Agent: Claude Code  Model: claude-sonnet-4         │
│ Session started: 14:23:01  Duration: 00:12:43      │
├────────────────────────────────────────────────────┤
│ LIVE TOKEN COUNTER                                 │
│                                                    │
│ Input tokens:   ████████████░░░  124,832          │
│ Cache hits:     ████░░░░░░░░░░░   48,291 (39%)    │
│ Output tokens:  ██░░░░░░░░░░░░░    8,441          │
│                                                    │
│ This session:    $1.23                             │
│ Rate:            $5.82/hour                        │
│ Projected today: $8.10                             │
├────────────────────────────────────────────────────┤
│ Last message: +1,203 tokens  14:35:44              │
└────────────────────────────────────────────────────┘
```

- Press **Q** to quit, press **S** to save a snapshot
- `--alert 5.00` — beep when session cost exceeds $5

```bash
tokenwise watch
tokenwise watch --alert 5.00
tokenwise watch --model opus
```

### `tokenwise compare` — Before/after savings proof

Compares two sessions and shows exactly what changed:

```
  Before:                           After:
  ──────────────────────────────────────────────────────
  Input tokens:     248,391         Input tokens:     89,234  (-64%)
  System prompt:      3,847         System prompt:       312  (-91.9%)
  Cache hit rate:       12%         Cache hit rate:      67%  (+55%)
  Cost:              $2.48          Cost:              $0.89  (-64%)

  You saved $1.59 per session
  Monthly savings estimate: $1,047/month
```

- Saves comparison history to `~/.tokenwise/comparisons.json`

```bash
tokenwise compare --before --after
tokenwise compare session1.jsonl session2.jsonl
```

### `tokenwise report` — HTML savings report

Generates a beautiful, shareable HTML report:

- Dark theme (#0d1117 background like GitHub dark)
- Clean cards with token stats
- Color-coded bar charts for wasteful patterns
- "Share your savings" section for Twitter/LinkedIn
- 100% self-contained HTML (no external deps, works offline)

```bash
tokenwise report
tokenwise report --open
tokenwise report --days 30
```

### `tokenwise ci` — GitHub Actions integration

CI/CD mode for automated token waste detection. Exits with code 1 if thresholds are exceeded:

- **FAIL** if any instruction file > 500 tokens
- **FAIL** if boilerplate > 30% of any file
- **FAIL** if any rule is unscoped
- **WARN** if total instruction tokens > 2000

Generates GitHub Actions annotations:
```
::error file=CLAUDE.md,line=1::tokenwise: 3,847 tokens (threshold: 500). Run tokenwise audit --fix
::warning file=.claude/rules/api.md::tokenwise: unscoped rule loads on every message
```

```bash
tokenwise ci
tokenwise ci --max-tokens 1000
tokenwise ci --max-boilerplate 20
tokenwise ci --warn-only
tokenwise ci --init          # create .github/workflows/tokenwise.yml
```

### `tokenwise history` — Session trends over time

Tracks token usage trends across sessions:

```
  Token usage — last 14 days

  Jun 12  ████████████████████  248,391  $2.48
  Jun 13  ████████████████░░░░  198,234  $1.98
  Jun 14  ██████████████░░░░░░  172,831  $1.73
  Jun 15  ████████░░░░░░░░░░░░   98,234  $0.98 ← after audit --fix
  Jun 16  ████████░░░░░░░░░░░░   89,123  $0.89

  Trend: -64% over the period
  Most expensive: Jun 12 ($2.48)
  Most efficient: Jun 16 ($0.89)
```

- Flags cost spikes above average
- CSV export for spreadsheet analysis

```bash
tokenwise history
tokenwise history --days 30
tokenwise history --export csv
```

### `tokenwise init` — Zero-config setup

Interactive setup wizard for new users. Detects agents, scans files, offers to run `audit --fix` immediately:

```
  Welcome to tokenwise!

  Detecting your AI agents...
  ✓ Claude Code — found 47 sessions in ~/.claude/projects/
  ✓ OpenCode — found opencode.db (24 sessions)
  ✗ Cursor — not detected

  Scanning your instruction files...
  ⚠  CLAUDE.md — 3,847 tokens (HIGH — threshold: 500)
  ⚠  .claude/rules/api.md — unscoped (loads every message)

  Quick win available: run tokenwise audit --fix to save ~$460/month
  Run it now? (Y/n)
```

Creates `~/.tokenwise/config.json` with preferences and `.tokenwise-ignore` file.

```bash
tokenwise init
```

---

<!-- omit in toc -->

## Supported agents

| Agent | Audit instruction files | Scan sessions | Config |
|---|---|---|---|
| **Claude Code** | CLAUDE.md, .claude/rules/ | ~/.claude/projects/ JSONL | Anthropic pricing |
| **OpenCode** | AGENTS.md, .opencode/agents/ | opencode.db SQLite | Anthropic pricing |
| **Cursor** | .cursorrules, .cursor/rules/ | — | — |
| **Aider** | .aider.conf.yml | .aider.chat.history.md | OpenAI pricing |
| **Cline** | .clinerules/, .clinerules | ~/.cline/data/sessions/ JSON | OpenAI pricing |
| **Codex CLI** | .codex/ | ~/.local/share/codex/sessions/ | OpenAI pricing |
| **Goose** | .goosehints | sessions.db SQLite | Anthropic pricing |
| **Continue.dev** | .continue/config.*, .continue/dev/ | .continue/sessions/ JSON | OpenAI pricing |
| **Windsurf** | .windsurfrules | — | — |
| **Augment** | .augment/rules/ | — (detect only) | — |
| **Kilocode** | .kilocode/rules/ | — | — |

**Global instruction files** are also scanned from your home directory (`~/.claude/CLAUDE.md`, `~/.cursorrules`, `~/.clinerules`, `~/.goosehints`, `~/.windsurfrules`, `~/.aider.conf.yml`, `~/.config/opencode/AGENTS.md`).

---

<!-- omit in toc -->

## CLI reference

### `tokenwise audit`

```
Options:
  --dir <path>         Project directory (default: cwd)
  --fix                Auto-fix safe issues (creates .bak backups)
  --json               Raw JSON output (for scripts/piping)
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
  --verbose            Show per-flag details with line numbers
  --threshold <tokens> Custom token threshold per file (default: 200 for excessive_length)
  --ignore <pattern>   Skip files matching pattern
  --output <file>      Save report to file
```

### `tokenwise scan`

```
Options:
  --session <path>    Path to specific session file
  --db <path>         Path to agent database (OpenCode, Goose)
  --agent <name>      Scan a specific agent: claude-code, opencode, aider, cline, codex-cli, goose, continue, auto
  --detect             List detected agents and exit
  --all                Scan ALL sessions, not just latest
  --since <date>       Scan sessions since a date (YYYY-MM-DD)
  --json               Raw JSON output (for scripts/piping)
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
```

### `tokenwise watch`

```
Options:
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
  --alert <number>     Alert when session cost exceeds $X

Keys:
  Q                    Quit
  S                    Save snapshot to ~/.tokenwise/
```

### `tokenwise compare`

```
Options:
  --before             Use second-to-last session as baseline
  --after              Use latest session
  --json               Raw JSON output
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini

Arguments:
  [session1]           Path to first session file
  [session2]           Path to second session file
```

### `tokenwise report`

```
Options:
  --dir <path>         Project directory (default: cwd)
  --open               Open report in default browser
  --days <days>        Number of days for trend analysis (default: 30)
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
```

### `tokenwise ci`

```
Options:
  --dir <path>              Project directory (default: cwd)
  --max-tokens <tokens>     Max tokens per file threshold (default: 500)
  --max-boilerplate <pct>   Max boilerplate percentage threshold (default: 30)
  --warn-only               Only warn, never fail
  --init                    Create .github/workflows/tokenwise.yml
```

### `tokenwise history`

```
Options:
  --days <days>        Number of days to show (default: 14)
  --export <format>    Export format: csv
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
```

### `tokenwise init`

```
(No options — interactive wizard)
```

---

<!-- omit in toc -->

## CI/CD Integration

Add tokenwise to your GitHub Actions workflow:

```bash
tokenwise ci --init    # creates .github/workflows/tokenwise.yml
```

Or manually add to any workflow:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install -g @davizin713/tokenwise
- run: tokenwise ci
```

The `ci` command outputs GitHub Actions annotations and exits with code 1 on failure, making it perfect for PR checks on instruction file changes.

---

<!-- omit in toc -->

## Token Savings Calculator

Formula for estimating monthly savings:

```
savings = (current_tokens - optimized_tokens) × price_per_M_tokens / 1M × messages_per_day × 22
```

Example: reducing CLAUDE.md from 3,847 to 312 tokens at Sonnet pricing ($3/M input):
- Per message: (3,847 - 312) × $3 / 1M = $0.01059
- Monthly (50 msg/day × 22 days): $0.01059 × 50 × 22 = **$11.65/month**
- With 91.9% fewer tokens loaded every message

---

<!-- omit in toc -->

## How it works

- **Token counting**: `js-tiktoken` with `o200k_base` encoding (~10% variance from Anthropic's proprietary tokenizer — sufficient for budget estimation)
- **Similarity detection**: Shingling (k=5) + Jaccard coefficient — no LLM, no API, no data leaves your machine
- **Cost estimation**: Hardcoded pricing for 7 models:

| Model | Input $/M | Output $/M | Cache Read $/M | Cache Write $/M |
|---|---|---|---|---|
| sonnet | 3.00 | 15.00 | 0.30 | 3.75 |
| haiku | 0.80 | 4.00 | 0.08 | 1.00 |
| opus | 15.00 | 75.00 | 1.50 | 18.75 |
| gpt-4o | 2.50 | 10.00 | 1.25 | 2.50 |
| gpt-4.1 | 2.00 | 8.00 | 0.50 | 2.00 |
| o3 | 10.00 | 40.00 | 2.50 | 10.00 |
| o4-mini | 1.50 | 6.00 | 0.375 | 1.50 |

- **SQLite reading**: `sql.js` (pure JS/WASM, zero native dependencies)
- **All local, all offline** — zero API calls, zero LLM inference

---

<!-- omit in toc -->

## Real examples

<details>
<summary><strong>audit output</strong></summary>

```
$ npx @davizin713/tokenwise audit --dir ~/my-project

  tokenwise audit — instruction file analysis

┌──────────┬──────────────────────┬────────┬───────┬───────────┬──────────────────────────────┬─────────┐
│ Severity │ File                 │ Tokens │ Lines │ Load Freq │ Flags                        │ Savings │
├──────────┼──────────────────────┼────────┼───────┼───────────┼──────────────────────────────┼─────────┤
│ HIGH     │ CLAUDE.md            │  2,341 │    87 │ EVERY MSG │ high_boilerplate, ...        │    -891 │
│ MED      │ .claude/rules/api.md │    412 │    15 │ EVERY MSG │ unscoped_rule                │    -243 │
│ LOW      │ .claude/rules/db.md  │    198 │     9 │ on demand │ ok                           │       - │
└──────────┴──────────────────────┴────────┴───────┴───────────┴──────────────────────────────┴─────────┘

  Summary
  Total tokens in instruction files:    2,951
  Reducible tokens:                    1,134 (38.4% reducible)
  Est. monthly cost (sonnet):          $4.43
  Est. monthly savings:               $1.70

  Quick win
  ★ CLAUDE.md: 891 reducible tokens on every-message file
    Saves $1.70/month

  Run tokenwise audit --fix to auto-fix safe issues.
```

</details>

<details>
<summary><strong>scan output</strong></summary>

```
$ npx @davizin713/tokenwise scan --model opus

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
$ npx @davizin713/tokenwise audit --json | jq '.files[0].flags'
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

- [x] **v0.2** — Multi-agent support (Aider, Cline, Codex CLI, Goose, Continue.dev, Windsurf, Augment, Kilocode), OpenAI pricing models (gpt-4o, gpt-4.1, o3, o4-mini), agent auto-detection (`--detect`)
- [x] **v0.3** — Live watch mode, compare sessions, HTML reports, CI/CD integration (`tokenwise ci`), session history trends, init wizard, severity scores, quick win callout, new scan/audit flags
- [ ] **v0.4** — Live watch mode with cost ticker improvements
- [ ] **v0.5** — MCP server for agent self-audit
- [ ] **v0.6** — Compact-config generator (auto-generate optimal /compact prompts)
- [ ] **v0.7** — tokenwise init improvements (personalized ignore patterns, team config sync)

---

<!-- omit in toc -->

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

<!-- omit in toc -->

## License

[MIT](./LICENSE) — built with :fire: by the community, for the community.
