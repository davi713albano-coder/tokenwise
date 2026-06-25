Run tokenwise audit on the current project. Execute:

```bash
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --verbose
```

Show the results to the user. If there are reducible tokens, offer to run:

```bash
npx @davizin713/tokenwise audit --dir $PROJECT_DIR --fix
```

After fixing, re-run audit to show the before/after comparison.
