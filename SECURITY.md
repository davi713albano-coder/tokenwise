# Security Policy

## Reporting a vulnerability

tokenwise is 100% local — it never sends data to any API or server. If you find a case where data leaks unexpectedly, please email davi713albano-coder on GitHub or open a private security advisory.

## Known security properties

- **No network calls**: All computation is local
- **No API keys**: tokenwise never requires or stores API keys  
- **Read-only scan**: `tokenwise scan` only reads session databases
- **Safe fixes**: `--fix` creates `.bak` backups and never deletes content
