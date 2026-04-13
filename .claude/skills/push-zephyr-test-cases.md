---
description: Sync Gherkin .feature files to Zephyr Scale by creating or updating Jira Test issues for each scenario. Triggers when asked to "push to Zephyr", "sync test cases", "create Zephyr test cases from feature files", or after generating feature files.
---

You have been invoked via `/push-zephyr-test-cases`.

Your job: sync all `.feature` files in the project to Zephyr Scale by creating or updating Jira issues of type "Test" for each scenario.

---

## Step 1 — Discover feature files

```bash
find . -name "*.feature" -not -path "*/node_modules/*" | sort
```

If no feature files are found, ask the user to generate them first:
- Tosca source → `/convert-tosca-to-gherkin`
- Document source → `/convert-worddoc-to-gherkin`
- Jira criteria → `/fetch-jira-issues` then generate

---

## Step 2 — Parse each feature file

For each `.feature` file, extract:

1. **Feature name** — from `Feature:` line
2. **Feature tags** — from the line(s) before `Feature:` (e.g., `@suite:Checkout`, `@Regression`)
3. **Linked Jira story** — look for `@Story-XXXXX` or `@jira:PROJ-42` tags
4. **Scenarios** — for each `Scenario:` or `Scenario Outline:`:
   - Scenario name
   - All step lines (Given/When/Then/And/But)
   - All scenario-level tags (including `@test-id:` if previously synced)
   - Priority tag if present (`@priority:High`, etc.)

---

## Step 3 — Sync each scenario to Zephyr

For each scenario, determine if it's new or existing:

### Existing scenario (has `@test-id:` tag)
The `@test-id:` value IS the Jira issue key for the Test issue.

Update the existing test case:
```
mcp__atlassian__jira_update_issue(
  key: "<test-id value>",
  summary: "<scenario name>",
  description: "Feature: <feature name>\n\nSteps:\n<Given/When/Then steps>"
)
```

### New scenario (no `@test-id:` tag)
Create a new Jira Test issue:
```
mcp__atlassian__jira_create_issue({
  project: "<project key from @Story- or @jira: tag>",
  issuetype: "Test",
  summary: "<Feature name> — <Scenario name>",
  description: "**Feature:** <feature name>\n\n**Steps:**\n<Given/When/Then steps formatted as ordered list>",
  labels: ["automated-qa", "gherkin", "<suite tag if present>"],
  priority: "<from @priority tag, default: Medium>"
})
```

If a `@Story-` or `@jira:` tag is present, link the new Test issue to the parent story using `mcp__atlassian__jira_update_issue` to add an issue link.

---

## Step 4 — Write test IDs back to feature files

For each newly created Test issue, write the `@test-id:` tag back into the feature file so future syncs are idempotent.

Find the scenario in the file and add the tag on the line above the `Scenario:` keyword:

Before:
```gherkin
  @Story-ADX-42 @Regression
  Scenario: Customer applies a promo code at checkout
```

After:
```gherkin
  @Story-ADX-42 @Regression @test-id:PROJ-TEST-99
  Scenario: Customer applies a promo code at checkout
```

---

## Step 5 — Report sync results

Print a summary table:

```
Zephyr Sync Complete
Timestamp: <ISO timestamp>

| Feature File | Scenarios | Created | Updated | Skipped | Errors |
|---|---|---|---|---|---|
| features/checkout/apply-promo.feature | 3 | 2 | 1 | 0 | 0 |
| features/cart/update-quantity.feature | 4 | 0 | 4 | 0 | 0 |

Total: <N> scenarios | <N> created | <N> updated | <N> errors

New Test Issues:
  PROJ-TEST-99: Customer applies a promo code at checkout
  PROJ-TEST-100: Customer applies expired promo code — sees error
```

If there are errors (e.g., missing project key, unknown issue type), list them clearly with the scenario name and the error so the user can resolve them.

---

## Notes on Zephyr Scale compatibility

Zephyr Scale stores test cases as Jira issues of type "Test". The steps are stored in the issue description or a dedicated test steps field (depending on Zephyr Scale version and configuration).

If your Jira instance has a dedicated "Test Steps" field for Zephyr, format the steps as:
```
Step 1: <Given step>
Step 2: <When step>
Step 3: <Then step>
```

If the Zephyr API is available as an MCP tool (e.g., `mcp__zephyr__*`), prefer using it directly over the Jira issue API for richer test case management.
