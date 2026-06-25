# tokenwise skill

Analyze and optimize token usage in AI coding agent sessions.

## Commands

### /tokenwise audit
Run tokenwise audit on the current project.
Show the results inline and offer to run --fix.

```bash
npx @davizin713/tokenwise audit --dir $PROJECT_DIR
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --fix
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --verbose
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --threshold 1000
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --output tokenwise-report.txt
```

### /tokenwise scan
Run tokenwise scan on the latest session.
Show cost breakdown and top token hogs.

```bash
npx @davizin713/tokenwise scan
npx @davizin713/tokenwise scan --model opus
npx @davizin713/tokenwise scan --all
npx @davizin713/tokenwise scan --since 2026-06-01
npx @davizin713/tokenwise scan --detect
npx @davizin713/tokenwise scan --agent auto
```

### /tokenwise watch
Start live token monitoring in background.

```bash
npx @davizin713/tokenwise watch
npx @davizin713/tokenwise watch --alert 5.00
npx @davizin713/tokenwise watch --model opus
```

### /tokenwise report
Generate HTML savings report and open it.

```bash
npx @davizin713/tokenwise report
npx @davizin713/tokenwise report --open
npx @davizin713/tokenwise report --days 30
```

### /tokenwise history
Show token usage trends for the last 14 days.

```bash
npx @davizin713/tokenwise history
npx @davizin713/tokenwise history --days 30
npx @davizin713/tokenwise history --export csv
```

### /tokenwise compare
Compare two sessions for before/after savings proof.

```bash
npx @davizin713/tokenwise compare --before --after
npx @davizin713/tokenwise compare session1.jsonl session2.jsonl
```

### /tokenwise ci
Run CI checks for token waste thresholds.

```bash
npx @davizin713/tokenwise ci
npx @davizin713/tokenwise ci --init
npx @davizin713/tokenwise ci --max-tokens 1000 --warn-only
```

### /tokenwise init
Interactive setup wizard for first-time users.

```bash
npx @davizin713/tokenwise init
```

## What tokenwise detects

8 audit heuristics (zero LLM calls, all local):
- excessive_length: >200 lines
- high_boilerplate: >25% generic advice
- excessive_emphasis: ALL-CAPS spam (NEVER/ALWAYS/MUST)
- duplicate_section: >60% Jaccard similarity between sections
- unscoped_rule: .claude/rules/ without paths: frontmatter
- redundant_with_config: instruction already in tsconfig/.prettierrc
- obvious_description: "src/ contains source code"
- empty_section: section header with no body

## Supported agents

Audit: Claude Code, OpenCode, Cursor, Aider, Cline, Codex CLI, Goose, Continue.dev, Windsurf, Augment, Kilocode
Scan: Claude Code, OpenCode, Aider, Cline, Codex CLI, Goose, Continue.dev
