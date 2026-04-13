---
description: Fetch Jira issues and extract acceptance criteria for test planning. Use when the user provides a Jira issue key (like PROJ-42), a JQL query, a sprint name, or asks to "pull criteria from Jira", "get the acceptance criteria for", or "what needs to be tested in".
---

You have been invoked via `/fetch-jira-issues`.

Your job: fetch Jira issues and extract their acceptance criteria in a structured format ready for test planning.

---

## Step 1 — Determine the query

Parse the user's request for one of these input formats:

| Input format | How to fetch |
|---|---|
| Single issue key: `PROJ-42` | `mcp__atlassian__jira_get_issue` with key |
| Multiple keys: `PROJ-42, PROJ-43` | Fetch each individually in sequence |
| JQL query | `mcp__atlassian__jira_search_issues_using_jql` |
| Sprint name: "Sprint 14" | JQL: `project = PROJ AND sprint = "Sprint 14" AND issuetype in (Story, Task, Bug)` |
| Status filter: "In Review stories" | JQL: `project = PROJ AND status = "In Review" AND issuetype = Story` |

If no project key is clear from context, ask: "Which Jira project key should I search in?"

---

## Step 2 — Fetch the issues

For a single issue:
```
mcp__atlassian__jira_get_issue(key: "PROJ-42")
```

For JQL:
```
mcp__atlassian__jira_search_issues_using_jql(jql: "...", maxResults: 50)
```

---

## Step 3 — Extract acceptance criteria

For each issue, extract:

1. **Issue key** — e.g., `PROJ-42`
2. **Summary** — the story/task title
3. **Acceptance Criteria** — look in this priority order:
   - Dedicated "Acceptance Criteria" custom field
   - "Given/When/Then" blocks in the description
   - Bullet lists that describe expected behavior
   - Numbered requirement lists in the description
4. **Linked URL** — any staging or environment URL mentioned in the issue
5. **Labels / Components** — used to route tests to the right feature area
6. **Priority** — used to determine test urgency

If an issue has no extractable acceptance criteria, flag it as: `⚠ No testable criteria found`.

---

## Step 4 — Format and display

Print results in this format:

```
## Jira Issues — QA Criteria Summary
Fetched: <timestamp>
Query: <key or JQL used>

---

### PROJ-42: <Summary>
Priority: High | Labels: checkout, payments
URL: https://demo.sgproof.com/checkout

Acceptance Criteria:
1. The checkout page must display the order total before payment
2. Users must be able to apply a promo code and see the discount reflected
3. Submitting with an expired card must show an error message: "Your card has expired"
4. A successful order must show a confirmation page with the order number

---

### PROJ-43: <Summary>
⚠ No testable criteria found — description contains only implementation notes

---

## Summary
| Key | Summary | Criteria | Status |
|-----|---------|----------|--------|
| PROJ-42 | Checkout flow | 4 criteria | Ready for test planning |
| PROJ-43 | Backend refactor | 0 criteria | Skipped |
```

---

## Step 5 — Offer next actions

After displaying the criteria, offer:
```
Next steps:
• Run /qa PROJ-42 to start a full end-to-end QA run from these criteria
• Run /push-zephyr-test-cases after generating feature files to sync with Zephyr Scale
• Run /convert-worddoc-to-gherkin if you have spec documents to supplement these criteria
```
