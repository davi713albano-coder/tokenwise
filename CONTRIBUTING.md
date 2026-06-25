# Contributing to tokenwise

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/davi713albano-coder/tokenwise.git
cd tokenwise
npm install
npm run build
npm test
```

## Development

```bash
npm run build     # Compile TypeScript
npm test          # Run tests
npm run lint      # Type-check only
```

## Project structure

```
src/
  cli.ts              # Commander CLI entry point
  audit/
    scanner.ts        # File discovery (CLAUDE.md, rules/, AGENTS.md)
    heuristics.ts     # 8 audit heuristics
    reporter.ts       # Table/chart/summary output
    fixer.ts          # Safe auto-fix transforms
    types.ts          # Type definitions
  scan/
    claude-code.ts    # Claude Code JSONL parser
    opencode.ts       # OpenCode SQLite parser
    reporter.ts       # Scan output formatting
  shared/
    counter.ts        # js-tiktoken wrapper
    pricing.ts        # Model pricing + cost estimation
    format.ts         # Number/cost/percent formatting + bar chart
tests/                 # Vitest test files (mirror src/ structure)
```

## Adding a new audit heuristic

1. Add the heuristic function in `src/audit/heuristics.ts`
2. Add it to the `auditContent()` function
3. Add tests in `tests/audit/heuristics.test.ts`
4. Add a fixer in `src/audit/fixer.ts` (if auto-fixable)

## Adding a new agent

1. Create `src/scan/<agent>.ts` with `findLatest()`, `parseSession()`, `analyzeTokens()`
2. Wire it into `src/cli.ts` `runScan()`
3. Add tests in `tests/scan/<agent>.test.ts`

## Guidelines

- **Pure JS, no native deps** — must work without Visual Studio / XCode
- **No LLM calls** — all heuristics must be local
- **Safe fixes only** — `--fix` never deletes content, always creates `.bak`
- **Windows compatible** — test paths with backslashes
- **Add tests** — aim for >80% coverage on new code

## PR process

1. Fork and create a feature branch
2. Make changes with tests
3. Ensure `npm run build && npm test` pass
4. Open PR with description of what changed and why

## Code of conduct

Be respectful. We're all here to save tokens (and money).
