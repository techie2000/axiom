---
name: address-pr-comments
description: >
  Address review comments (including Copilot comments) on the active pull
  request and post resolution updates. Implements Axiom-specific feedback
  resolution: individual thread replies, comprehensive summary, and linked
  issue updates—all automatic.
context: fork
argument-hint: "Optionally specify a reviewer name or file to focus on"
---

# Address PR Review Comments

Read the active pull request, identify unresolved review comments and feedback,
implement the requested changes, post individual resolution replies to each
thread, create a comprehensive summary, and mirror updates to linked issues.

## When to Use

- A reviewer has left comments or change requests on the active PR
- You need to systematically work through all open review threads
- You want to respond to or implement reviewer feedback
- You've fixed Copilot feedback and need to post resolutions

## Procedure

### 1. Read the Active PR

Call `github-pull-request_currentActivePullRequest`.

**Refresh logic**:

- Call once without `refresh` to get cached state
- Inspect `lastUpdatedAt` field
- If timestamp is **less than 3 minutes ago**, the PR is changing—call again with `refresh: true`
- If older than 3 minutes, proceed with cached data

### 2. Identify Unresolved Comments

From the result, collect feedback needing action:

- **`reviewThreads` array**: Inline threads with `id`, `isResolved` flag,
  `canResolve` flag, `file` path, and nested `comments`. Focus on threads where
  `isResolved` is `false`.
- **`timelineComments` array**: General PR comments where `commentType` is `"CHANGES_REQUESTED"` or `"COMMENTED"`
- **Linked issues**: Extract from PR body (e.g., `Refs #123`, `Fixes #456`) for later issue updates

Group related threads by file to handle efficiently.

### 3. Categorize Feedback by Type

Before implementing, categorize comments to structure your response:

- **🔴 Transaction/Consistency Safety**: Data integrity, audit placement, transaction boundaries
- **🟡 Performance**: N+1 queries, inefficient patterns, unnecessary operations
- **🟢 Test Coverage**: Missing or insufficient test coverage
- **🔵 Code Quality**: Simplification, refactoring, best practices
- **⚪ Configuration/Linting**: Markdown, YAML, formatting compliance

### 4. Plan Changes

For each unresolved comment:

1. Read it carefully and understand the concern
2. Identify the file and exact location
3. Determine the minimal correct fix (not all comments require changes)
4. Note dependencies between comments (e.g., a rename affecting multiple files)
5. If unclear or contradictory, plan a reply asking for clarification instead

### 5. Implement Changes

Work through grouped comments file by file:

- Read the relevant file section before editing
- Apply the requested change
- Do not refactor code outside the scope of each comment
- Commit changes with a clear message: `fix: address review feedback on [category]`

### 6. Track Resolutions (Session Memory)

Maintain a list of comment IDs and their resolution status:

```text
✅ RESOLVED (4)
├─ 3045230708 - Transaction Safety - [description]
├─ 3045230751 - Transaction Safety - [description]
├─ 3045230772 - Performance - [description]
└─ 3046789012 - Code Quality - [description]

⏳ DEFERRED (1)
└─ 3045230787 - Test Coverage - [Reason: Requires test DB setup]
```

### 7. Post Individual Resolution Comments (Automatic)

**DO NOT ask for confirmation.** For each resolved comment, post a reply to that thread:

```bash
gh pr comment <pr-number> --reply-to <comment-id> --body-file "/path/to/resolution.md"
```

#### Resolution Comment Template by Type

### Transaction Safety

```markdown
✅ **RESOLVED**: [Issue type - e.g., Audit write before UPDATE]

**Problem**: [Original concern]

**Solution**: Reordered operations to ensure [atomic behavior/consistency]
- Database operation executes first
- Audit/logging only occurs if operation succeeds
- Prevents invalid audit records on failure

**Validation**: All tests pass, no functional changes to behavior
```

### Performance

```markdown
✅ **RESOLVED**: [Issue type - e.g., N+1 query pattern]

**Problem**: [Original performance concern]

**Solution**: [Specific optimization applied]
- Before: [Old pattern with impact]
- After: [New pattern with benefit]
- Impact: [Measurable improvement or reasoning]

**Validation**: Local performance verified, existing tests pass
```

### Test Coverage

```markdown
✅ **RESOLVED**: [Test coverage for behavior]

**Added/Updated Tests**: [Which test functions cover this]

**Scenarios Covered**:
- [Happy path test]
- [Error/edge case test]
- [Regression test if applicable]

**Validation**: `go test ./...` passes with full coverage on affected modules
```

### Code Quality

```markdown
✅ **RESOLVED**: [Simplification/refactoring]

**Change**: [What was simplified or improved]

**Benefit**: [Readability, maintainability, or performance improvement]

**Validation**: Existing tests pass, behavior unchanged
```

### Configuration/Linting

```markdown
✅ **RESOLVED**: [Config/lint issue]

**Change**: [What was updated or fixed]

**Validation**: `make docs-check`, linters pass
```

Use the safe comment helper if available to verify rendered body before posting.
For Bash shells, use the `gh pr comment --reply-to` command shown above.

```powershell
pwsh ./scripts/post-gh-comment-safe.ps1 `
  -Repo "techie2000/axiom" `
  -TargetType pr `
  -PrNumber <pr-number> `
  -ReplyToId <comment-id> `
  -BodyFile "path/to/resolution.md"
```

### 8. Push and Verify (Automatic)

After all changes are committed:

1. Push to the PR branch: `git push origin <branch>`
2. Verify all replies were posted to threads
3. Collect any deferred items (tests needing infrastructure, follow-ups, etc.)

### 9. Create Comprehensive Summary (Automatic)

**DO NOT ask for confirmation.** Post a summary comment on the main PR:

```bash
gh pr comment <pr-number> --body-file "/path/to/summary.md"
```

#### Summary Template

```markdown
## Copilot Review Feedback: [X] Issues Resolved ✅

All substantive feedback has been addressed. Below is a categorized breakdown.

### Summary by Category

| Category | Count | Status | Notes |
|----------|-------|--------|-------|
| Transaction Safety | X | ✅ | [Specific items] |
| Performance | X | ✅ | [Specific items] |
| Test Coverage | X | ⏳ | [If deferred, note follow-up plan] |
| Code Quality | X | ✅ | [Specific items] |

### Detailed Resolutions

#### 🔴 Transaction Safety (X resolved)
- **[Issue 1]**: [Resolution summary—what changed and why]
- **[Issue 2]**: [Resolution summary]

#### 🟡 Performance (X resolved)
- **[Issue 1]**: [Resolution summary]
- **[Issue 2]**: [Resolution summary]

#### 🟢 Test Coverage (X resolved)
- **[Issue 1]**: [Resolution summary]

### Validation Checklist

- ✅ All existing tests pass: `go test ./...` or `npm test`
- ✅ Code compiles without errors
- ✅ [CI checks status] running with fixes
- ✅ No functional behavior changes (fixes improve safety/performance/coverage)

### Non-Applicable Comments

- **[Comment type]**: N/A - [Reason, e.g., "Files removed in earlier cleanup"]

### Follow-Up Items

If any feedback is deferred:
- **[Issue type]**: Deferred to [future PR/phase]
  - Reason: [Why it's deferred]
  - What's needed: [Infrastructure, dependencies, etc.]

---

**The PR is ready for review** with all substantive feedback addressed. 🚀
```

Verify the rendered body immediately:

```bash
gh pr view <pr-number> --repo techie2000/axiom --comments
```

### 10. Mirror Updates to Linked Issues (Automatic)

**DO NOT ask for confirmation.** For each linked issue (extracted from PR body):

```bash
gh issue comment <issue-number> --repo techie2000/axiom --body "..."
```

#### Issue Update Template

```markdown
**Implementation Status**: ✅ Feedback Addressed

- PR: [#<pr-number>](https://github.com/techie2000/axiom/pull/<pr-number>)
- Branch: `<branch-name>`
- Validation: All tests passing, CI checks complete

**What Changed**:
- [Brief 1-2 sentence summary of implementation]
- [Performance or safety improvements made]

**For Testing**: See PR #<pr-number> for detailed changes and validation steps.

**Next Steps**: Awaiting final review before merge.
```

Verify the issue comment was posted:

```bash
gh issue view <issue-number> --repo techie2000/axiom --comments
```

---

## Best Practices

1. **Timing**:
   - Post individual resolutions **immediately after pushing each fix**
   - Post comprehensive summary **after all fixes are pushed and CI has started**
   - Do not merge until all threads are resolved

2. **Clarity**:
   - Reference specific line numbers or commit SHAs
   - Explain the "why" not just the "what"
   - Link related issues or ADRs if applicable

3. **Consistency**:
   - Use same terminology as the original feedback when summarizing
   - Group related fixes in summary (e.g., all transaction safety together)
   - Keep resolution comments concise (1-3 bullet points per issue)

4. **Validation**:
   - Always verify fixes locally before posting resolution comments
   - Run relevant test suites: `go test ./... -cover`, `npm test`
   - Wait for initial CI checks before posting comprehensive summary

---

## See Also

- `copilot-pr-feedback-resolution.instructions.md` - Detailed workflow
- `copilot-pr-comment-tracking.instructions.md` - Comment ID tracking patterns
- `github-comment-formatting.instructions.md` - Comment formatting rules
