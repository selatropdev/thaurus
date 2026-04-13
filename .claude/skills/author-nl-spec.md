---
description: Author a .nl.md spec file from requirements, a Jira issue, user story, or existing test. Generates the YAML frontmatter and structured Behavior sections with Given/When/Then. Use when asked to "write a spec for", "create an NL spec", or "author the spec file for [feature]".
---

# Skill: Author NL Spec

You have been invoked via `/author-nl-spec`.

## Role

You are an NL Spec Author. Your output is a `.nl.md` spec file that becomes the source of truth for test generation. It must be precise, testable, and unambiguous. Every behavior must be expressible as a Jest assertion.

---

## Input Detection

Detect the input type and extract requirements accordingly:

| Input Type | Detection | Action |
|---|---|---|
| Jira issue key | Pattern `[A-Z]+-\d+` (e.g., `PROJ-42`) | Fetch with `mcp__atlassian__jira_get_issue`, extract summary + AC field + Given/When/Then blocks |
| User story text | "As a… I want… So that…" | Parse AC bullet list or Given/When/Then blocks from the text |
| Document path | `.docx`, `.pdf`, `.md` file path | Read and extract requirement statements |
| Existing test file | `.test.ts` or `.spec.ts` path | Read test bodies, reverse-engineer behaviors from `it()` descriptions and assertions |
| Raw description | Plain text requirement | Parse as-is |

If the input is ambiguous between two types, ask one clarifying question.

---

## Frontmatter Fields

Generate all five required fields. Do not omit any.

### `module`
Format: `area/feature` (e.g., `auth/login`, `cart/checkout`, `orders/history`).
- Derive from Jira component or label
- Derive from file path if an existing test is the input
- If unknown, ask: "What module area does this belong to? (e.g., `auth/login`)"

### `layer`
Exactly one of: `unit` | `integration` | `e2e`
- `unit`: testing a pure function or class method with no I/O
- `integration`: testing logic that crosses a service, database, or API boundary
- `e2e`: browser-driven test scenario
- When ambiguous, ask one question.

### `priority`
Map from Jira priority if available:
- Highest / High → `P1`
- Medium → `P2`
- Low / Lowest → `P3`
- Default `P2` if unknown.

### `version`
Always `1` for new specs. Integer only.

### `tags`
Array of lowercase strings.
- Always include the feature area (e.g., `auth`)
- Include `smoke` if the scenario is a critical-path happy-path
- Derive additional tags from Jira labels, components, or test suite names

---

## Behavior Extraction Rules

Each acceptance criterion, Given/When/Then block, or testable requirement becomes one behavior section.

**Structure each behavior as:**
```
## Behavior N: <description>
- Given: <concrete preconditions with actual values>
- When: <single action or event being tested>
- Then: <observable outcome expressed as a Jest assertion>
```

**Description:** Human-readable sentence stating what is validated. Examples:
- "valid credentials log the user in"
- "applying an expired promo code shows an error"
- "cart total recalculates when item quantity changes"

**Given:** Concrete preconditions with actual values where possible.
- Not: "the user is logged in"
- Yes: `email="user@sgws.com", password="secret", account status="active"`

**When:** The single action or event under test. One action per behavior.

**Then:** Observable outcome using Jest-verifiable expressions:
- Exact strings for static values: `returns { success: true }`
- Regex for dynamic values: `token matches /^[A-Za-z0-9]{32}$/`
- Truthy/falsy for booleans: `isAuthenticated is true`
- Error assertions: `throws AuthError with message "Invalid credentials"`

**Coverage requirements:**
- Minimum 2 behaviors per spec, maximum 12
- Must include at least one negative/edge case behavior (invalid input, error state, boundary condition, empty state) unless the feature has no error paths
- Flag to the user if more than 12 behaviors are needed — the spec may need to be split

---

## File Path Convention

- Co-locate with source: `src/<module-path>/<filename>.nl.md`
  - Example: spec for `src/auth/login.ts` → `src/auth/login.nl.md`
- If source path is unknown: `nl-specs/<module-path>/<filename>.nl.md`
  - Example: `nl-specs/auth/login.nl.md`
- Filename: kebab-case of the feature/function being specced

---

## Output Format

Produce the complete `.nl.md` file content. Example:

```markdown
---
module: auth/login
layer: unit
priority: P1
version: 1
tags: [smoke, auth]
---

## Behavior 1: valid credentials log the user in
- Given: email="user@sgws.com", password="secret", account status="active"
- When: login({ email, password }) is called
- Then: returns { success: true, token: matches /^[A-Za-z0-9]{32}$/, userId: string }

## Behavior 2: invalid password returns an auth error
- Given: email="user@sgws.com", password="wrong", account status="active"
- When: login({ email, password }) is called
- Then: throws AuthError with message "Invalid credentials" and does NOT set a session cookie

## Behavior 3: inactive account is rejected before password check
- Given: email="inactive@sgws.com", password="secret", account status="suspended"
- When: login({ email, password }) is called
- Then: throws AccountError with message "Account suspended" without querying the auth service
```

---

## Validation Checklist

Run before writing the file. All items must pass:

- [ ] All five frontmatter fields present: `module`, `layer`, `priority`, `version`, `tags`
- [ ] `version` is an integer ≥ 1
- [ ] `layer` is exactly one of: `unit`, `integration`, `e2e`
- [ ] `priority` is exactly one of: `P1`, `P2`, `P3`
- [ ] `tags` is a non-empty array
- [ ] At least 2 behaviors present, each with Given, When, and Then
- [ ] At least one negative or edge-case behavior
- [ ] No raw Jira boilerplate in behavior text ("AC1:", "Acceptance Criteria:", "As a user")
- [ ] No vague Then statements ("it works correctly", "the result is expected")
- [ ] Token estimate: spec content under 4000 tokens (flag if over — split the spec)

---

## Write the File

After passing validation, write the file using the Write tool to the determined path.

---

## Post-Write

State: "NL spec written to `<path>`. Run `/generate-from-nl-spec <path>` to generate the Jest test file and update the manifest."
