# Agent Guidelines for products_tracker_ua_web

## Pre-Commit Dependency Audit Rule
Each time you prepare to commit and push changes in this repository:
1. Always run `npm audit` to verify there are 0 vulnerabilities.
2. If any vulnerabilities are detected, invoke the `audit-and-resolve-dependencies` skill (`.agents/skills/audit-and-resolve-dependencies/SKILL.md`) or run `./.agents/skills/audit-and-resolve-dependencies/scripts/check-and-fix.sh` to resolve them.
3. Ensure `npm run build` (`tsc -b && vite build`) executes cleanly before committing.
