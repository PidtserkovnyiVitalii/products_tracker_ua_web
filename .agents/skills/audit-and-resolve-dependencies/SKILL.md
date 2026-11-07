---
name: audit-and-resolve-dependencies
description: >-
  Audits npm dependencies, resolves security vulnerabilities, and verifies project builds.
  Use this skill whenever working in the web repository, especially before committing or
  pushing changes, or when asked to check and fix npm vulnerabilities or resolve dependency conflicts.
---

# Audit and Resolve Dependencies

This skill guides the agent through inspecting, repairing, and verifying npm dependencies and security vulnerabilities for the web frontend (`products_tracker_ua_web`).

## Workflow Steps

### 1. Run Security Audit Check
Run the audit check script or execute `npm audit`:
- Using helper script:
  ```bash
  ./.agents/skills/audit-and-resolve-dependencies/scripts/check-and-fix.sh
  ```
- Or run manually:
  ```bash
  npm audit
  ```

### 2. Resolve Vulnerabilities
If vulnerabilities are found:
1. **Automated safe fix**:
   ```bash
   npm audit fix
   ```
2. **Unused or Abandoned Packages**:
   - Check if the reported package is actually imported anywhere in `src/`:
     ```bash
     grep -rn "from ['\"]<package-name>['\"]" src/
     ```
   - If a modern or styled alternative is already in use (e.g. `xlsx-js-style` replacing `xlsx`), remove the redundant unmaintained package:
     ```bash
     npm uninstall <package-name>
     ```
3. **Transitive / Peer Dependency Constraints**:
   - For deeply nested dependencies where sub-packages require older vulnerable versions (e.g. `minimatch`, `esbuild`), specify targeted overrides in `package.json`:
     ```json
     "overrides": {
       "@typescript-eslint/typescript-estree": {
         "minimatch": "^11.0.5"
       },
       "esbuild": "^0.28.2"
     }
     ```
   - Run `npm install` after editing `package.json` to refresh the lockfile.

### 3. Verification & Integrity Check
Before staging or committing any dependency changes:
1. Verify `npm audit` reports **0 vulnerabilities**:
   ```bash
   npm audit
   ```
2. Run production build and type-checking to ensure no breaking changes or runtime regressions:
   ```bash
   npm run build
   ```

### 4. Commit Updates
Stage both `package.json` and `package-lock.json` alongside any feature or fix commits:
```bash
git add package.json package-lock.json
```
