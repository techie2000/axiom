# Security API Access for the Copilot Coding Agent

## The Problem

When the Copilot coding agent is asked to review security findings, it runs into a permission
wall for three specific GitHub APIs:

| API | Required scope | Agent token has it? |
| --- | -------------- | ------------------- |
| `GET /repos/{owner}/{repo}/dependabot/alerts` | `security_events` read | ❌ No |
| `GET /repos/{owner}/{repo}/code-scanning/alerts` | `security_events` read | ❌ No |
| `GET /repos/{owner}/{repo}/secret-scanning/alerts` | `secret_scanning_alerts` read | ❌ No |

The agent runs with a GitHub App token (`ghu_…`) that is intentionally issued with **zero OAuth
scopes** — a safe default that prevents read/write access to anything beyond what the app itself
needs. The `X-OAuth-Scopes` header on that token is empty, so security-sensitive APIs return `403
Resource not accessible by integration`.

The `gh` CLI and the GitHub MCP server tools are both affected, because they use the same
underlying token.

---

## Short-Term Workaround (Paste Context)

This requires no setup. Run the relevant `gh` commands **yourself** in a terminal where you are
authenticated as a user (not the agent), then paste the output into the chat alongside your
request.

```bash
# Dependabot alerts
gh api /repos/techie2000/axiom/dependabot/alerts \
  --jq '.[] | "[\(.security_advisory.severity)] \(.security_advisory.summary) — \(.dependency.package.name)"'

# Code scanning alerts
gh api /repos/techie2000/axiom/code-scanning/alerts?state=open \
  --jq '.[] | "[\(.rule.severity)] \(.rule.description) — \(.most_recent_instance.location.path)"'
```

Then open a task with something like:

> Here are the current Dependabot alerts: `<paste output>`. Fix any that can be addressed
> cleanly with low risk.

---

## Medium-Term Fix (Security Report Workflow)

`.github/workflows/security-report.yml` is available in this repository. It runs in a real GitHub
Actions context where the `GITHUB_TOKEN` **does** have `security_events: read` permission (set
explicitly in the workflow's `permissions` block).

### Trigger it

```bash
gh workflow run security-report.yml
# or via GitHub UI → Actions → Security Report → Run workflow
```

### Use the output

After the run finishes, the report is committed to `docs/security/latest-report.md`. Pull the
branch and that file is immediately readable by the agent:

```bash
git pull
# then in the agent task:
# "Review docs/security/latest-report.md and fix any issues"
```

The workflow also runs on a weekly schedule (every Monday 08:00 UTC) so there is always a
reasonably fresh report without manual intervention.

---

## Long-Term Fix (Fine-Grained PAT as Repository Secret)

If you want the agent to call the security APIs **live** without any manual steps, store a
Personal Access Token with the right permissions as a repository secret. The agent's environment
in GitHub Actions can then be configured to use that token.

### Step 1 — Create a fine-grained PAT

1. Go to **GitHub.com → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
2. Set:
   - **Token name**: `axiom-security-read`
   - **Repository access**: Only `techie2000/axiom`
   - **Permissions → Repository permissions**:
     - `Code scanning alerts` → **Read-only**
     - `Dependabot alerts` → **Read-only**
     - `Secret scanning alerts` → **Read-only** (optional)

### Step 2 — Store it as a repository secret

1. Go to **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `SECURITY_READ_TOKEN`
3. Value: paste the PAT

### Step 3 — Use it in a workflow

Any workflow can then call the APIs using this token:

```yaml
- name: Fetch Dependabot alerts
  env:
    GH_TOKEN: ${{ secrets.SECURITY_READ_TOKEN }}
  run: gh api /repos/${{ github.repository }}/dependabot/alerts
```

### Step 4 — Make it available to the agent

Currently the Copilot agent task runner does not automatically inject arbitrary repository secrets
into the agent's shell environment. The practical way to bridge this is the workflow approach
above — use the PAT **inside** a workflow that commits results to a file the agent can read.

---

## What the Agent CAN Do Without Additional Setup

Even without security API access, the agent can:

| Check | How |
| ----- | --- |
| **npm audit** | `cd frontend && npm audit` — zero vulnerabilities as of last run |
| **Go dependency review** | Read `backend/go.mod` and `backend/go.sum` directly |
| **Workflow action version auditing** | Grep `.github/workflows/` for pinned vs unpinned action refs |
| **Dockerfile security review** | Read `docker/Dockerfile.*` for common anti-patterns |
| **OWASP static analysis** | Inspect Go handler code for injection / auth / CSRF issues |

For the GitHub-specific APIs (Dependabot / code scanning), use one of the approaches above.

---

## Summary

| Approach | Effort | Agent reads live data? |
| -------- | ------ | ---------------------- |
| Paste context manually | None (you do it) | On demand |
| `security-report.yml` workflow | Low (already set up) | Via committed file |
| Fine-grained PAT + secret | Medium (one-time setup) | Via workflow |
