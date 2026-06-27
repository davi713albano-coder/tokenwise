<div align="center">

# tokenwise

**Stop burning tokens. Start saving money.**

Cross-agent token waste analytics and automated fixes for AI coding agents.
No API keys. No LLM calls. No data leaves your machine.

[![npm version](https://img.shields.io/npm/v/@davizin713/tokenwise?color=brightgreen&label=npm)](https://www.npmjs.com/package/@davizin713/tokenwise)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/tokenwise?label=node%20%3E%3D18)](https://nodejs.org/)
[![GitHub stars](https://img.shields.io/github/stars/davi713albano-coder/tokenwise?style=social)](https://github.com/davi713albano-coder/tokenwise)
[![GitHub issues](https://img.shields.io/github/issues/davi713albano-coder/tokenwise)](https://github.com/davi713albano-coder/tokenwise/issues)

```bash
npx @davizin713/tokenwise audit    # trim instruction files
npx @davizin713/tokenwise scan     # analyze session logs
npx @davizin713/tokenwise watch   # live cost ticker
npx @davizin713/tokenwise report   # HTML savings report
```

</div>

---

## The problem

You are paying **$500+/month** in AI coding agent API costs. Half those tokens are waste:

- Boilerplate instructions the model already follows ("Always write clean code")
- ALL-CAPS emphasis that does not make the model obey better
- Duplicate sections across CLAUDE.md files
- Rules that load on every message instead of when relevant
- Session history that balloons until you `/compact`

**You cannot optimize what you cannot measure.** That is tokenwise.

---

## Features

- **8 static heuristics, zero LLM calls** -- detects boilerplate, shouting, duplication, unscoped rules, redundant config, empty sections, and more
- **Auto-fix mode** -- `audit --fix` safely de-boilerplates, de-shoutifies, deduplicates, and scopes rules (creates `.bak` backups, never deletes content)
- **Session scanning** -- reads Claude Code, OpenCode, Aider, Cline, Codex CLI, Goose, and Continue.dev session logs
- **Live cost ticker** -- real-time dashboard with per-session and per-hour cost tracking
- **Before/after comparisons** -- quantify exactly how much `audit --fix` saved you
- **HTML reports** -- self-contained, shareable reports with dark theme and bar charts
- **CI/CD integration** -- GitHub Actions mode with annotation output and configurable thresholds
- **Session history trends** -- track token usage over time with CSV export
- **7 pricing models** -- Sonnet, Haiku, Opus, GPT-4o, GPT-4.1, o3, o4-mini
- **100% local and offline** -- zero API calls, zero LLM inference, no data leaves your machine

---

## Quick Start

No install required:

```bash
npx @davizin713/tokenwise audit
npx @davizin713/tokenwise scan
```

Install globally:

```bash
npm i -g @davizin713/tokenwise
tokenwise audit
tokenwise scan
```

First time? Run the setup wizard:

```bash
npx @davizin713/tokenwise init
```

---

## Usage

### audit -- Trim instruction file waste

Scans your instruction files and shows exactly where tokens are burning:

```
┌──────────┬──────────────────────┬────────┬───────┬───────────┬────────────────────┬─────────┐
│ Severity │ File                 │ Tokens │ Lines │ Load Freq │ Flags              │ Savings │
├──────────┼──────────────────────┼────────┼───────┼───────────┼────────────────────┼─────────┤
│ HIGH     │ CLAUDE.md            │  2,341 │    87 │ EVERY MSG │ boilerplate, ...   │    -891 │
│ MED      │ .claude/rules/api.md │    412 │    15 │ EVERY MSG │ unscoped_rule      │    -243 │
│ LOW      │ .claude/rules/db.md  │    198 │     9 │ on demand │ ok                 │       - │
└──────────┴──────────────────────┴────────┴───────┴───────────┴────────────────────┴─────────┘
```

8 heuristics, zero LLM calls, zero API keys:

| Heuristic | What it catches | Fix |
|---|---|---|
| `excessive_length` | >200 lines | Split into scoped rule files |
| `high_boilerplate` | >25% generic advice | Remove -- model already knows |
| `excessive_emphasis` | NEVER/ALWAYS/MUST/CRITICAL spam | De-shoutify to normal tone |
| `duplicate_section` | >60% Jaccard similarity between sections | Merge or remove duplicate |
| `unscoped_rule` | .claude/rules/ without `paths:` frontmatter | Add `paths:` to scope loading |
| `redundant_with_config` | Instruction already in tsconfig/.prettierrc | Remove -- config enforces it |
| `obvious_description` | "src/ contains source code" | Remove -- model can discover this |
| `empty_section` | `## Architecture` with no body | Fill or remove |

Auto-fix with `--fix`:

```bash
tokenwise audit --fix                                        # apply safe transforms
tokenwise audit --threshold 1000 --verbose                   # custom threshold + details
tokenwise audit --ignore ".cursorrules" --output report.txt  # skip files, save report
```

Creates `.bak` backups. Never deletes content. Only safe transforms: de-boilerplate, de-shoutify, deduplicate, remove empty sections, add `paths:` stubs.

### scan -- Analyze session token usage

Reads your latest AI coding agent session and shows where tokens went:

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

Key metrics: cache hit rate (target >50%), top 3 token hogs, cost projection per-session and monthly across 7 pricing models, cost alerts.

```bash
tokenwise scan --agent auto         # auto-detect best available agent
tokenwise scan --all                # scan ALL sessions
tokenwise scan --since 2026-06-01   # sessions since a date
tokenwise scan --detect             # list detected agents
```

### watch -- Live cost ticker

Real-time dashboard that updates every 2 seconds as your AI agent works:

```
┌─ tokenwise watch ──────────────────────────────────┐
│ Agent: Claude Code  Model: claude-sonnet-4          │
│ Session started: 14:23:01  Duration: 00:12:43      │
├─────────────────────────────────────────────────────┤
│ LIVE TOKEN COUNTER                                  │
│                                                     │
│ Input tokens:   ████████████░░░  124,832           │
│ Cache hits:     ████░░░░░░░░░░░   48,291 (39%)     │
│ Output tokens:  ██░░░░░░░░░░░░░    8,441           │
│                                                     │
│ This session:    $1.23                              │
│ Rate:            $5.82/hour                         │
│ Projected today: $8.10                              │
├─────────────────────────────────────────────────────┤
│ Last message: +1,203 tokens  14:35:44               │
└─────────────────────────────────────────────────────┘
```

Press **Q** to quit, **S** to save a snapshot. Use `--alert 5.00` to beep when session cost exceeds $5.

```bash
tokenwise watch
tokenwise watch --alert 5.00
tokenwise watch --model opus
```

### compare -- Before/after savings proof

Compares two sessions and shows exactly what changed:

```
  Before:                           After:
  --------------------------------------------------
  Input tokens:     248,391         Input tokens:     89,234  (-64%)
  System prompt:      3,847         System prompt:       312  (-91.9%)
  Cache hit rate:       12%         Cache hit rate:      67%  (+55%)
  Cost:              $2.48          Cost:              $0.89  (-64%)

  You saved $1.59 per session
  Monthly savings estimate: $1,047/month
```

```bash
tokenwise compare --before --after
tokenwise compare session1.jsonl session2.jsonl
```

### report -- HTML savings report

Generates a self-contained HTML report with dark theme, token stat cards, color-coded bar charts, and a shareable savings section. Works offline.

```bash
tokenwise report
tokenwise report --open       # open in browser
tokenwise report --days 30    # 30-day trend analysis
```

### ci -- GitHub Actions integration

Exits with code 1 if thresholds are exceeded. Generates GitHub Actions annotations:

```
::error file=CLAUDE.md,line=1::tokenwise: 3,847 tokens (threshold: 500). Run tokenwise audit --fix
::warning file=.claude/rules/api.md::tokenwise: unscoped rule loads on every message
```

```bash
tokenwise ci                        # run with defaults
tokenwise ci --max-tokens 1000      # custom token threshold
tokenwise ci --max-boilerplate 20   # custom boilerplate threshold
tokenwise ci --warn-only             # warn only, never fail
tokenwise ci --init                  # create .github/workflows/tokenwise.yml
```

### history -- Session trends over time

Tracks token usage trends across sessions with cost spike detection and CSV export:

```
  Token usage - last 14 days

  Jun 12  ████████████████████  248,391  $2.48
  Jun 13  ████████████████░░░░  198,234  $1.98
  Jun 14  ██████████████░░░░░  172,831  $1.73
  Jun 15  ████████░░░░░░░░░░░   98,234  $0.98  after audit --fix
  Jun 16  ████████░░░░░░░░░░░   89,123  $0.89

  Trend: -64% over the period
```

```bash
tokenwise history
tokenwise history --days 30
tokenwise history --export csv
```

### init -- Zero-config setup

Interactive setup wizard that detects agents, scans files, and offers to run `audit --fix` immediately.

```bash
npx @davizin713/tokenwise init
```

---

## How It Works

```
  Instruction files (CLAUDE.md, .cursorrules, etc.)  ──►  Heuristic scanner
         │                                                    │
         │                                             8 static checks
         │                                             (no LLM, no API)
         │                                                    │
         ▼                                                    ▼
  Token counter                                      Severity + savings
  (js-tiktoken,                                           estimate
   o200k_base)
         │                                                    │
         ▼                                                    ▼
  Cost calculator                                      Auto-fix (--fix)
  (7 pricing models)                                    (safe transforms,
                                                         .bak backups)
```

Core architecture:

- **Token counting**: `js-tiktoken` with `o200k_base` encoding (~10% variance from Anthropic's proprietary tokenizer -- sufficient for budget estimation)
- **Similarity detection**: Shingling (k=5) + Jaccard coefficient -- no LLM, no API, no data leaves your machine
- **SQLite reading**: `sql.js` (pure JS/WASM, zero native dependencies) for OpenCode and Goose session databases
- **Cost estimation**: Hardcoded pricing for 7 models

| Model | Input $/M | Output $/M | Cache Read $/M | Cache Write $/M |
|---|---|---|---|---|
| sonnet | 3.00 | 15.00 | 0.30 | 3.75 |
| haiku | 0.80 | 4.00 | 0.08 | 1.00 |
| opus | 15.00 | 75.00 | 1.50 | 18.75 |
| gpt-4o | 2.50 | 10.00 | 1.25 | 2.50 |
| gpt-4.1 | 2.00 | 8.00 | 0.50 | 2.00 |
| o3 | 10.00 | 40.00 | 2.50 | 10.00 |
| o4-mini | 1.50 | 6.00 | 0.375 | 1.50 |

---

## Supported Agents

| Agent | Audit instruction files | Scan sessions | Pricing |
|---|---|---|---|
| **Claude Code** | CLAUDE.md, .claude/rules/ | ~/.claude/projects/ JSONL | Anthropic |
| **OpenCode** | AGENTS.md, .opencode/agents/ | opencode.db SQLite | Anthropic |
| **Cursor** | .cursorrules, .cursor/rules/ | -- | -- |
| **Aider** | .aider.conf.yml | .aider.chat.history.md | OpenAI |
| **Cline** | .clinerules/ | ~/.cline/data/sessions/ JSON | OpenAI |
| **Codex CLI** | .codex/ | ~/.local/share/codex/sessions/ | OpenAI |
| **Goose** | .goosehints | sessions.db SQLite | Anthropic |
| **Continue.dev** | .continue/config.*, .continue/dev/ | .continue/sessions/ JSON | OpenAI |
| **Windsurf** | .windsurfrules | -- | -- |
| **Augment** | .augment/rules/ | -- (detect only) | -- |
| **Kilocode** | .kilocode/rules/ | -- | -- |

Global instruction files are also scanned from your home directory (`~/.claude/CLAUDE.md`, `~/.cursorrules`, `~/.clinerules`, `~/.goosehints`, `~/.windsurfrules`, `~/.aider.conf.yml`, `~/.config/opencode/AGENTS.md`).

---

## CLI Reference

### `tokenwise audit`

```
Options:
  --dir <path>         Project directory (default: cwd)
  --fix                Auto-fix safe issues (creates .bak backups)
  --json               Raw JSON output (for scripts/piping)
  --model <model>      Cost model: sonnet (default), haiku, opus, gpt-4o, gpt-4.1, o3, o4-mini
  --verbose            Show per-flag details with line numbers
  --threshold <tokens> Custom token threshold per file (default: 200)
  --ignore <pattern>   Skip files matching pattern
  --output <file>      Save report to file
```

### `tokenwise scan`

```
Options:
  --session <path>    Path to specific session file
  --db <path>         Path to agent database (OpenCode, Goose)
  --agent <name>      Agent: claude-code, opencode, aider, cline, codex-cli, goose, continue, auto
  --detect             List detected agents and exit
  --all                Scan ALL sessions, not just latest
  --since <date>       Scan sessions since a date (YYYY-MM-DD)
  --json               Raw JSON output
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

No options -- interactive wizard.

---

## CI/CD Integration

```bash
tokenwise ci --init    # creates .github/workflows/tokenwise.yml
```

Or add manually to any workflow:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install -g @davizin713/tokenwise
- run: tokenwise ci
```

The `ci` command outputs GitHub Actions annotations and exits with code 1 on failure, making it ideal for PR checks on instruction file changes.

---

## Token Savings Calculator

```
savings = (current_tokens - optimized_tokens) x price_per_M_tokens / 1M x messages_per_day x 22
```

Example: reducing CLAUDE.md from 3,847 to 312 tokens at Sonnet pricing ($3/M input):
- Per message: (3,847 - 312) x $3 / 1M = $0.01059
- Monthly (50 msg/day x 22 days): $0.01059 x 50 x 22 = **$11.65/month**
- With 91.9% fewer tokens loaded every message

---

## Roadmap

- [x] **v0.2** -- Multi-agent support (Aider, Cline, Codex CLI, Goose, Continue.dev, Windsurf, Augment, Kilocode), OpenAI pricing models, agent auto-detection
- [x] **v0.3** -- Live watch mode, compare sessions, HTML reports, CI/CD integration, session history, init wizard, severity scores
- [ ] **v0.4** -- Live watch mode with cost ticker improvements
- [ ] **v0.5** -- MCP server for agent self-audit
- [ ] **v0.6** -- Compact-config generator (auto-generate optimal /compact prompts)
- [ ] **v0.7** -- Init improvements (personalized ignore patterns, team config sync)

---

## Contributing

PRs welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Run tests before submitting:

```bash
npm run lint    # TypeScript type check
npm test        # Vitest test suite
```

---

## License

[MIT](./LICENSE)
