---
description: 'Automated workflow for resolving Copilot PR review feedback by addressing code comments and posting resolution summaries'
applyTo: '**'
---

# Copilot PR Feedback Resolution Workflow

## Overview

When Copilot provides review feedback on a pull request, implement fixes and
automatically manage feedback resolution without requiring explicit user prompts
for each step. This instruction describes the complete automated workflow from
identifying feedback to posting resolution summaries.

## Workflow Trigger

This workflow activates automatically when:

- Copilot has left review comments on a PR (either inline code comments or general review feedback)
- You have implemented code changes to address that feedback
- You are about to push commits to the PR branch

## Step 1: Identify Copilot Feedback

**Fetch all Copilot comments on the active PR:**

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --jq '.[] | select(.user.login == "Copilot") | {id: .id, path: .path, line: .line, body: .body}'
```

**Categorize feedback into types:**

- 🔴 **Transaction/Consistency Safety Issues** - Data integrity concerns
- 🟡 **Performance Issues** - N+1 queries, inefficient patterns, unnecessary operations
- 🟢 **Test Coverage Issues** - Missing or insufficient test coverage
- 🔵 **Code Quality Issues** - Simplification, refactoring, best practices
- ⚪ **Configuration/Linting Issues** - Markdown, YAML, formatting compliance

## Step 2: Implement Code Fixes

For each Copilot comment:

1. **Understand the concern** - Read the full comment and suggested fix
2. **Implement in code** - Apply the fix to the relevant source file(s)
3. **Test locally** - Verify the fix works and doesn't break existing functionality
4. **Commit with clarity** - Use commit message that references the Copilot feedback:

  ```text
   fix: address Copilot review feedback on [category]
   
   - [Specific change 1]
   - [Specific change 2]
   ```

## Step 3: Post Individual Resolution Comments

**For each Copilot comment you've addressed**, automatically post a reply to that specific comment thread:

```bash
gh pr comment 261 --reply-to {comment_id} --body "✅ **RESOLVED**: [Brief explanation of fix]

**What changed:**
- [Specific code change or reordering]
- [Performance improvement or safety guarantee]

**Validation:**
- [How you validated the fix]
- [Tests run or checks performed]"
```

### Comment Template by Issue Type

#### 🔴 Transaction Safety

```markdown
✅ **RESOLVED**: [Issue type - e.g., Audit write before UPDATE]

**Problem**: [Original concern from Copilot]

**Solution**: Reordered operations to ensure [atomic behavior/consistency]
- Database operation executes first
- Audit/logging only occurs if operation succeeds
- Prevents invalid audit records on failure

**Validation**: All tests pass, no functional changes to behavior
```

#### 🟡 Performance

```markdown
✅ **RESOLVED**: [Issue type - e.g., N+1 query pattern]

**Problem**: [Original performance concern]

**Solution**: [Specific optimization applied]
- Before: [Old pattern with impact]
- After: [New pattern with benefit]
- Impact: [Measurable improvement or reasoning]

**Validation**: Local performance verified, existing tests pass
```

#### 🟢 Test Coverage

```markdown
✅ **RESOLVED**: [Test coverage for behavior]

**Added/Updated Tests**: [Which test functions cover this]

**Scenarios Covered**:
- [Happy path test]
- [Error/edge case test]
- [Regression test if applicable]

**Validation**: `go test ./...` passes with full coverage on affected modules
```

#### 🔵 Code Quality

```markdown
✅ **RESOLVED**: [Simplification/refactoring]

**Change**: [What was simplified or improved]

**Benefit**: [Readability, maintainability, or performance improvement]

**Validation**: Existing tests pass, behavior unchanged
```

## Step 4: Create Summary Comment

After pushing all fixes and individual resolution comments, **automatically post a comprehensive summary** on the main PR:

```bash
gh pr comment {pr_number} --body "[Generated summary from Step 5 below]"
```

## Step 4.5: Mirror Updates To Linked Issues After Each Push

After each push where you post PR status or resolution comments, automatically post concise status updates on each
linked underlying issue (for example `Refs #123`, or `Fixes/Closes #123` when `#123` is confirmed to be an issue and
not a pull request). Do not wait
until the final PR summary comment.

**Post on each linked issue after each relevant push:**

```bash
gh issue comment {issue_number} --repo {owner}/{repo} --body "[Status update with testing guidance]"
```

Include:

- implementation status,
- validation/test results,
- user/UAT testing guidance,
- direct PR link.

## Step 5: Generate Comprehensive Summary

**Structure:**

```markdown
## Copilot Review Feedback: [X] Issues Resolved ✅

[Opening statement about addressing feedback]

### Summary by Category

| Category | Count | Status | Notes |
|----------|-------|--------|-------|
| Transaction Safety | X | ✅ | [Specific items] |
| Performance | X | ✅ | [Specific items] |
| Test Coverage | X | ⏳ | [If deferred, note follow-up plan] |
| Code Quality | X | ✅ | [Specific items] |

### Detailed Resolutions

#### 🔴 Transaction Safety (X resolved)
- **[Issue 1]**: [Resolution summary]
- **[Issue 2]**: [Resolution summary]

#### 🟡 Performance (X resolved)
- **[Issue 1]**: [Resolution summary]
- **[Issue 2]**: [Resolution summary]

### Validation Checklist

- ✅ All existing tests pass: `[test command run]`
- ✅ Code compiles without errors
- ✅ [CI checks status] running with fixes
- ✅ No functional behavior changes (fixes improve safety/performance)

### Non-Applicable Comments

If some Copilot comments don't apply to this PR:
- **[Comment type]**: N/A - [Reason, e.g., "Files removed in earlier cleanup"]

### Follow-Up Items

If any comments are deferred for later:
- **[Issue type]**: Deferred to [future PR/phase]
  - [Reason and context]
  - [What will be needed: infrastructure, dependencies, etc.]

---

**The PR is ready for review** with all substantive feedback addressed. 🚀
```

## Execution Guidelines

### Do NOT Ask Permission

- **Before generating summary comment**: Do not ask user "Should I post this?"
- **Before pushing to PR**: Do not ask "Should I commit and push?"
- **Execute automatically**: Treat these steps as part of the standard workflow

### Use Proper Markdown Formatting

- Follow [github-comment-formatting.instructions.md](github-comment-formatting.instructions.md)
- Use real multiline Markdown, not escaped `\n`
- Test with `gh api ... --jq .body` to verify rendering before submitting

### Comment in Correct Scope

- **Individual resolutions**: Reply directly to the Copilot comment thread using `--reply-to {comment_id}`
- **Summary comment**: Post as standalone comment on the PR using `gh pr comment`
- **Issue updates**: Post concise mirrored updates on linked underlying issues using `gh issue comment`
- **Never duplicate**: Don't post the same resolution in multiple places

## Error Handling

If pushing to the PR fails or CI checks fail:

1. **Identify the issue** from terminal output or CI logs
2. **Fix locally** and recommit
3. **Push again** with updated commit message
4. **Update summary comment** to reflect any changes

If you cannot locate a Copilot comment ID:

- Use `gh api repos/{owner}/{repo}/pulls/{pr}/comments` to list all comments
- Filter by `.user.login == "Copilot"`
- Extract the `.id` for the reply-to target

## Best Practices

### Timing

- Post individual resolutions **immediately after pushing each fix**
- Post comprehensive summary **after all fixes are pushed and CI has started**

### Clarity

- Reference specific line numbers or commit SHAs in comments
- Explain the "why" not just the "what"
- Link related issues or ADRs if applicable

### Consistency

- Use same terminology/phrasing as Copilot's feedback when summarizing
- Group related fixes in summary (e.g., all transaction safety issues together)
- Keep resolution comments concise (1-3 bullet points per issue)

### Validation

- Always verify fixes locally before posting resolution comments
- Run relevant test suites: `go test ./... -cover`, `npm test`, etc.
- Wait for initial CI checks to complete before posting comprehensive summary

## Examples

### Example 1: Transaction Safety Fix

**Copilot Comment:**
> "Audit write before UPDATE causes inconsistency if UPDATE fails"

**Resolution Comment Posted:**

```text
✅ **RESOLVED**: Transaction safety - Audit after UPDATE

**Change**: Reordered audit write to occur after successful UPDATE
- UPDATE executes first
- If UPDATE succeeds: write DELETE audit
- If UPDATE fails: skip audit, log warning, continue

**Validation**: All tests pass, transaction behavior verified
```

### Example 2: Performance Fix

**Copilot Comment:**
> "N+1 query pattern: per-row SELECT lookups double database round-trips"

**Resolution Comment Posted:**

```text
✅ **RESOLVED**: Performance - Eliminated N+1 queries

**Change**: Batch-load existing records into in-memory map
- Before: for each record: SELECT 1 → decide create/update
- After: SELECT all once → for each record: map lookup → decide
- Benefit: Single DB query instead of N, enables audit diffing

**Validation**: Tests pass, performance verified locally
```

## See Also

- [code-review-generic.instructions.md](code-review-generic.instructions.md) - Code review standards
- [github-comment-formatting.instructions.md](github-comment-formatting.instructions.md) - Comment formatting requirements
- [test-driven-maintenance.instructions.md](test-driven-maintenance.instructions.md) - Test requirements for code changes
