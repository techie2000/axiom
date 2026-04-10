---
description: 'Companion file for tracking Copilot PR comment thread IDs and resolution status during feedback resolution workflow'
applyTo: '**'
---

# Copilot PR Comment Thread ID Tracking

## Overview

When resolving multiple Copilot comments on a PR, tracking comment IDs and their
resolution status prevents duplicate efforts and ensures no feedback is missed.
This file provides structured patterns for identifying, organizing, and tracking
comment threads.

## Quick Reference: How to Get Comment IDs

### Get All Copilot Comments with IDs

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '.[] | select(.user.login == "Copilot") | {id: .id, path: .path, line: .line, body: .body[:100]}'
```

### Get Comments by File (Easier for Large PRs)

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '.[] | select(.user.login == "Copilot" and .path == "backend/internal/service/masterdata_service.go") | {id: .id, line: .line}'
```

### Get Just the Comment IDs

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '[.[] | select(.user.login == "Copilot") | .id]'
```

## Tracking Structure

### Format 1: Quick Status Tracker (For Session Notes)

Use this in your session memory or as inline comments during work:

```markdown
## PR #261 Copilot Feedback Tracking

### Transaction Safety Issues
- **Comment ID 3045230708** (Line 473, currencies.go)
  - Status: ✅ FIXED
  - Fix: Moved audit write after UPDATE
  - Post: Posted as reply 14:32 UTC
  
- **Comment ID 3045230751** (Line 217, continents.go)
  - Status: ✅ FIXED
  - Fix: Moved audit write after DELETE
  - Post: Posted as reply 14:35 UTC

### Performance Issues
- **Comment ID 3045230772** (Line 662, code_mappings.go)
  - Status: ✅ FIXED
  - Fix: Batch-load instead of per-row SELECT
  - Post: Posted as reply 14:38 UTC

### Test Coverage
- **Comment ID 3045230787** (Line 204)
  - Status: ⏳ DEFERRED
  - Reason: Requires test DB infrastructure
  - Follow-up: Next PR
  - Post: Noted in summary
```

### Format 2: Detailed Issue Tracking (For Complex PRs)

```json
{
  "pr_number": 261,
  "copilot_comments": [
    {
      "id": 3045230708,
      "file": "backend/internal/service/masterdata_service.go",
      "line": 473,
      "category": "Transaction Safety",
      "issue": "Audit write before UPDATE",
      "status": "resolved",
      "fix_commit": "5340e2c",
      "reply_posted": true,
      "reply_time": "2026-04-07T14:32:00Z"
    },
    {
      "id": 3045230751,
      "file": "backend/internal/service/masterdata_service.go",
      "line": 217,
      "category": "Transaction Safety",
      "issue": "Audit write before DELETE",
      "status": "resolved",
      "fix_commit": "5340e2c",
      "reply_posted": true,
      "reply_time": "2026-04-07T14:35:00Z"
    }
  ],
  "summary_posted": true,
  "summary_time": "2026-04-07T15:00:00Z"
}
```

## Batch Operations Using IDs

### Reply to Multiple Comments with Status Updates

**Setup - Get all comment IDs first:**

```bash
gh api repos/techie2000/axiom/pulls/261/comments \
  --jq '.[] | select(.user.login == "Copilot") | .id' \
  > /tmp/copilot_comment_ids.txt
```

**Then post to each:**

```bash
while IFS= read -r comment_id; do
  gh pr comment 261 --reply-to "$comment_id" --body "✅ **RESOLVED**: [Your resolution message]"
done < /tmp/copilot_comment_ids.txt
```

### Organize Comments by Type

```bash
# Get all comments organized by file and category
gh api repos/techie2000/axiom/pulls/261/comments \
  --jq 'group_by(.path) | map({
    file: .[0].path,
    count: length,
    comments: map({id: .id, line: .line, type: (.body | if contains("N+1") then "Performance" elif contains("audit") then "Safety" elif contains("test") then "Tests" else "Other" end)})
  })'
```

## Common ID Organization Patterns

### Pattern 1: By Category + File

```text
TRANSACTION SAFETY (3 comments)
├─ masterdata_service.go (3)
│  ├─ Comment 3045230708 - Line 473
│  ├─ Comment 3045230751 - Line 217
│  └─ Comment 3046789012 - Line 345
│
PERFORMANCE (1 comment)
├─ masterdata_service.go (1)
│  └─ Comment 3045230772 - Line 662
│
TEST COVERAGE (1 comment)
├─ masterdata_service_test.go (1)
│  └─ Comment 3045230787 - Line 204
│
MARKDOWN LINT (3 comments) - N/A
├─ frontend-ui.instructions.md
├─ copilot-instructions.md
└─ [Files removed in cleanup]
```

### Pattern 2: By Status

```text
✅ RESOLVED (4)
├─ 3045230708 - Transaction Safety - currencies.go
├─ 3045230751 - Transaction Safety - continents.go
├─ 3045230772 - Performance - code_mappings.go
└─ 3046789012 - Code Quality - service.go

⏳ DEFERRED (1)
└─ 3045230787 - Test Coverage - [Requires test DB setup]

⚪ N/A (3)
├─ [Markdown files removed]
```

### Pattern 3: By Reply Status

```text
REPLIED (4)
├─ 3045230708 ✓ replied at 14:32
├─ 3045230751 ✓ replied at 14:35
├─ 3045230772 ✓ replied at 14:38
└─ 3045230787 ✓ replied at 14:50 (deferred note)

NOT REPLIED (0)

SUMMARY (1)
└─ Posted at 15:00 with complete resolution overview
```

## Workflow: Using IDs to Track Resolution

### Step 1: Extract and Organize

```bash
# Extract all Copilot comment IDs and save to file
gh api repos/techie2000/axiom/pulls/261/comments \
  --jq '.[] | select(.user.login == "Copilot") | "\(.id),\(.path),\(.line),\(.body[0:50])"' \
  > comments_to_address.csv

# Now review comments_to_address.csv and mark which you'll address
```

### Step 2: Track as You Fix

```markdown
## Addressing Comments - Session 1

### Working On:
- [ ] Comment 3045230708 (Line 473) - **IN PROGRESS**
  - File: backend/internal/service/masterdata_service.go
  - Issue: Audit write before UPDATE
  - Fix: Reordering audit call
  
### Completed:
- [x] Comment 3045230708 (Line 473)
  - Fix commit: abc1234
  - Reply posted: Yes
  
### To Address Later:
- [ ] Comment 3045230787 (Line 204)
  - Reason: Needs test DB infrastructure
  - When: Next sprint
```

### Step 3: Post Replies Using IDs

```bash
# After implementing fix and committing:

# Reply to comment 3045230708
gh pr comment 261 --reply-to 3045230708 --body "✅ **RESOLVED**: Reordered audit to after UPDATE

**Change**: Moved s.createCurrencyAudit() to occur AFTER successful database update
- Now UPDATE executes first
- Then audit write only if update succeeds
- Prevents invalid audit on failure

**Validation**: Tests pass, behavior maintained"

# Reply to comment 3045230751
gh pr comment 261 --reply-to 3045230751 --body "✅ **RESOLVED**: Reordered audit to after DELETE

**Change**: Moved s.createContinentAudit() to occur AFTER successful database deletion
- Now DELETE executes first
- Then audit write only if delete succeeds

**Validation**: Tests pass, audit consistency verified"
```

### Step 4: Verify All Replied

```bash
# Check which comments you've replied to
gh api repos/techie2000/axiom/pulls/261/comments \
  --jq '[.[] | select(.user.login == "Copilot") | {id: .id, repliedCount: (.. | objects | select(.user.login != "Copilot") | .user.login) | length}]'
```

## Preventing Common Mistakes

### Mistake 1: Forgetting a Comment ID

**Prevention:**

```bash
# Save original count
ORIGINAL_COUNT=$(gh api repos/techie2000/axiom/pulls/261/comments \
  --jq '[.[] | select(.user.login == "Copilot")] | length')

echo "Total Copilot comments to address: $ORIGINAL_COUNT"

# After posting all replies, verify you posted to same count
REPLIED_COUNT=4  # You manually count as you post

if [ "$ORIGINAL_COUNT" -eq "$REPLIED_COUNT" ]; then
  echo "✅ All comments addressed"
else
  echo "⚠️  Missing $((ORIGINAL_COUNT - REPLIED_COUNT)) replies"
fi
```

### Mistake 2: Replying to Wrong Comment ID

**Prevention:**

```bash
# Always verify comment ID before posting
COMMENT_ID="3045230708"
gh api repos/techie2000/axiom/pulls/261/comments/$COMMENT_ID \
  --jq '{id: .id, path: .path, line: .line, preview: .body[0:80]}'

# Review output before posting reply
gh pr comment 261 --reply-to $COMMENT_ID --body "[Your reply]"
```

### Mistake 3: Missing Comments in Pagination

**Prevention:**

```bash
# GitHub API paginates at 30 items by default
# Use --paginate to get all
gh api repos/techie2000/axiom/pulls/261/comments --paginate \
  --jq '[.[] | select(.user.login == "Copilot") | .id]' \
  > all_copilot_ids.txt

wc -l all_copilot_ids.txt  # Verify you got all
```

## Integration with Resolution Workflow

### Before Starting Fixes

```bash
# Create a tracking snapshot
gh api repos/techie2000/axiom/pulls/261/comments --paginate \
  --jq '.[] | select(.user.login == "Copilot") | {id: .id, file: .path, line: .line, status: "pending"}' \
  > pr261_copilot_tracking.json

echo "Tracking created: $(jq 'length' pr261_copilot_tracking.json) comments"
```

### While Fixing

```bash
# Update tracking file as you address each one
# (Manual or via script)

# Check progress
jq '[.[] | select(.status == "resolved") | .id]' pr261_copilot_tracking.json | wc -l
```

### After All Fixes

```bash
# Verify all comments addressed
jq '.[] | select(.status != "resolved" and .status != "deferred" and .status != "n/a")' pr261_copilot_tracking.json

# Should return empty if all handled
```

## Advanced: Automated Status Tracking

### Script: Track Comments and Post Updates

```bash
#!/bin/bash
# track-copilot-comments.sh

PR_NUMBER=$1
OWNER="techie2000"
REPO="axiom"

# Fetch all Copilot comments
echo "Fetching all Copilot comments..."
gh api repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments --paginate \
  --jq '.[] | select(.user.login == "Copilot")' > copilot_comments.json

echo "Found $(jq 'length' copilot_comments.json) Copilot comments"

# Group by category
echo ""
echo "### Comments by File:"
jq -s 'group_by(.path) | .[] | {file: .[0].path, count: length}' copilot_comments.json

echo ""
echo "### Comment IDs for Tracking:"
jq -s '.[] | "\(.id),\(.path),\(.line)"' copilot_comments.json | column -t -s','
```

Usage:

```bash
chmod +x track-copilot-comments.sh
./track-copilot-comments.sh 261
```

## Troubleshooting Comment ID Issues

### Issue: "Comment ID not found"

```bash
# Verify comment still exists
gh api repos/techie2000/axiom/pulls/261/comments/3045230708

# If deleted, it won't exist but that's OK - note it as removed
```

### Issue: "Reply-to Comment ID invalid"

```bash
# Ensure format is correct (must be numeric ID, not thread ID)
gh api repos/techie2000/axiom/pulls/261/comments \
  --jq '.[] | select(.user.login == "Copilot") | .id'

# Use numeric ID from above, not node_id
```

### Issue: "Already replied to this comment"

```bash
# GitHub doesn't prevent duplicate replies, but you can check:
gh api repos/techie2000/axiom/pulls/261/comments/3045230708/replies \
  --jq '.[] | {author: .user.login, created: .created_at}'
```

## See Also

- [copilot-pr-feedback-resolution.instructions.md](copilot-pr-feedback-resolution.instructions.md)
  - Main feedback resolution workflow
- [github-comment-formatting.instructions.md](github-comment-formatting.instructions.md) - Comment reply formatting
