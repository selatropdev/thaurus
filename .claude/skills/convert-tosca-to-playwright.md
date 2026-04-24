---
description: Convert a Tosca TSU file into Playwright TypeScript spec files using the @selatropdev/selatrophub framework. Use when the user provides a .tsu file and asks for Playwright tests, spec files, TypeScript automation, or runnable test code from Tosca.
---

You have been invoked via `/convert-tosca-to-playwright`.

You are a highly specialized translator for deep-parsing Tosca TSU files and producing production-quality Playwright TypeScript test code using the `@selatropdev/selatrophub` framework. The output is runnable automation code, not documentation.

# Core Philosophy

- **The TSU is the ONLY required input** — it is a complete, self-contained export of the Tosca test workspace. Read it exhaustively: every entity, every association, every attribute, every parameter. Nothing is skipped.
- **Playwright code is the deliverable** — produce runnable TypeScript using `@playwright/test` and `@selatropdev/selatrophub/web`. Follow existing patterns in the consuming project wherever they exist.
- **Business intent, technical precision** — translate Tosca's low-level UI actions into idiomatic Playwright assertions and interactions. Use semantic locators. Do not produce brittle XPath-heavy tests.
- **Data-driven tests are first-class** — Tosca parameterization maps to `test.each`. Resolve all data tokens before generating code.

---

# Step 0 — Locate and prepare

If the user provided a `.tsu` file path, use it directly. If not, search:
```bash
find . -name "*.tsu" -not -path "*/node_modules/*" | head -10
```

Check for an existing Thaurus project structure (`playwright.config.ts`, `src/tests/`). If missing:
```bash
npx -p @selatropdev/thaurus thaurus-setup
```

---

# TSU Deep Parse

## Decompression
The `.tsu` file is gzip-compressed JSON. Decompress with Bash then parse the result. The root object contains an `Entities[]` array holding every object in the Tosca workspace.
```bash
gunzip -c <file>.tsu > /tmp/tsu-decompressed.json
```

## Required Indexes — build before any traversal

Build all four indexes by iterating ALL entities once before any traversal begins:

| Index | Key | Value | Purpose |
|---|---|---|---|
| `surrogate_map` | `Entity.Surrogate` (UUID) | Full entity object | Primary lookup — all cross-references use Surrogates |
| `class_index` | `Entity.ObjectClass` | Array of matching entities | Fast filtering by type |
| `parent_index` | `Entity.Assocs.ParentFolder` | Array of child entities | Reverse lookup |
| `name_index` | `Entity.Attributes.Name` | Array of matching entities | Lookup by name |

## Entity Classification

### Structural Entities
- **TCProject** — Root container. Entry point. No direct code output.
- **TestCase** — One `*.spec.ts` file per TestCase. `Attributes.Name` → `test.describe` block name.
- **TestStepFolder** — Classify by `Attributes.Condition` or `Attributes.Name`:
  - `Precondition` → `beforeEach` / `test.beforeEach` block
  - `Postcondition` → `afterEach` / `test.afterEach` block (teardown via API preferred)
  - `Process` → individual `test()` block
- **TestStepFolderReference** — RTB call. Follow `Assocs.ReusedItem` to resolve definition. Examine this reference's own `Items[]` for parameter overrides. Translate to a helper call or inline steps depending on reuse scope.

### Step Entities
- **XTestStep** — Leaf-level atomic action. Collect `Attributes.Name`, `Attributes.ActionMode`, and all child `XTestStepValue` entities.
- **XTestStepValue** — Value for a leaf step. Extract `Attributes.Name`, `Attributes.Value`, `Attributes.ActionMode`, `Attributes.ModuleAttribute`. Scan `Attributes.Value` for tokens: `{B[...]}`, `{XB[...]}`, `{TDS[...]}`, `{CP[...]}`.

### Module Entities
- **XModule** — UI element/API endpoint definition. Module names (e.g. `ProposalDetailPage`, `LoginDialog`) → page object class names or fixture names.
- **XModuleAttribute** — A specific element in a module (e.g. `AccountName`, `SubmitButton`). Attribute names → locator semantics.

### Data Entities
- **TDSType** — Test data category (users, accounts, etc.).
- **TDSInstance** — Specific instance with constraints (e.g. `UserType=SM`). Constraints → test data setup values or fixture parameters.

### Infrastructure Entities (translate with judgment)
RecoveryScenario, ExecutionEntry → omit. TBox operations, buffer manipulation → omit or map to variable assignments. Browser open/close → `page` fixture handles this. TaskKill → omit. Cache/cookie cleanup → `context.clearCookies()` or `storageState` reset if relevant.

## Traversal Algorithm

**Step 0 — Index Everything**: Iterate ALL entities. Build all four indexes. Complete before any traversal.

**Step 1 — Discover Test Cases**: Filter `class_index` for `ObjectClass === 'TestCase'`. Each → one `.spec.ts` file.

**Step 2 — Walk Top-Level Structure**: For each TestCase, retrieve `Assocs.Items[]`. Classify each direct child as Precondition/Process/Postcondition.

**Step 3 — Expand Each Section**: Walk `Assocs.Items[]` recursively:
- `TestStepFolder` → continue recursion into its `Items[]`
- `TestStepFolderReference` → resolve RTB (Step 4), then recurse into definition's `Items[]`
- `XTestStep` → leaf, collect all data, stop recursion

**Step 4 — Resolve RTB Chains (Deep)**:
1. Read `Assocs.ReusedItem` → get definition Surrogate
2. Look up in `surrogate_map`. If not found → flag as external module reference
3. Read definition's `Assocs.Items[]`
4. If any item is also a `TestStepFolderReference` → recurse from step 1
5. Continue until all branches terminate at `XTestStep` leaves
6. Also examine the Reference's own `Items[]` for parameter overrides — these OVERRIDE definition defaults
7. Track the full chain: Reference → Definition → [nested refs] → leaf steps

**Step 5 — Collect Step Details**: For every leaf `XTestStep`: `Attributes.Name`, `Attributes.ActionMode`, `Attributes.Condition`, `Attributes.Path`, child `XTestStepValue` entities, associated `XModule`/`XModuleAttribute`, all data tokens.

**Step 6 — Build Complete Step Sequence**: Ordered list of leaf steps per section per test case, with all RTBs fully resolved, all parameter bindings applied.

---

# Data Resolution

Resolve ALL tokens before generating code. Zero raw Tosca tokens in output.

## Token Types

**`{B[VariableName]}`** and **`{XB[VariableName]}`** — Runtime buffer variable.
- Written by one step, read by subsequent steps → map to a TypeScript `const` or `let` variable in the test scope
- If it's a generated value (GUID, timestamp) → `const createdId = await ...` capturing the return value of the action
- If it carries data between RTBs → variable scoped to the `test.describe` block or passed as return value of a helper

**`{TDS[TypeName.FieldName]}`** — Test Data Service lookup.
1. Parse TypeName and FieldName
2. Find `TDSType` entity, then `TDSInstance` with its constraints
3. Map constraints to fixture parameters or test data objects
4. Multiple instances with different constraints → `test.each` rows

**`{CP[ParamName]}`** — Configuration parameter.
- Runner infrastructure (Browser, Timeout) → omit, handled by Playwright config
- Environment (OrgId, BaseURL) → read from `process.env` or Playwright `baseURL`
- Business-relevant config → test fixture parameter

**Business Parameters** — Child entities of `TestStepFolderReference`.
- `Attributes.Name` = param name, value from `Attributes.Value` or child `XTestStepValue`
- Resolve recursively (values may contain tokens)
- Become function arguments or `test.each` columns

---

# ActionMode → Playwright Mapping

| Tosca ActionMode | Playwright equivalent |
|---|---|
| `Input` / `Enter` | `await page.fill(locator, value)` |
| `Click` | `await page.click(locator)` |
| `Select` / `SelectItem` | `await page.selectOption(locator, value)` |
| `Verify` / `Assert` | `await expect(page.locator(...)).toXxx(value)` |
| `WaitOn` | `await page.waitForSelector(locator)` or `await expect(locator).toBeVisible()` |
| `Scroll` | `await page.locator(locator).scrollIntoViewIfNeeded()` |
| `Hover` | `await page.hover(locator)` |
| `Check` / `Uncheck` | `await page.check(locator)` / `await page.uncheck(locator)` |
| `Navigate` | `await page.goto(url)` |
| `GetValue` / `CaptureBuffer` | `const val = await page.locator(locator).inputValue()` |

**Locator strategy** (in preference order):
1. `getByRole()` with accessible name — preferred for buttons, links, headings, inputs
2. `getByLabel()` — for form fields with associated labels
3. `getByTestId()` — for components with `data-testid` attributes
4. `getByText()` — for unique visible text content
5. CSS selector from `XModuleAttribute.Attributes.Path` as last resort (wrap in `page.locator()`)

---

# Code Generation

## File Naming & Location
- Pattern: `tests/{suite-name-kebab-case}/{test-case-name-kebab-case}.spec.ts`
- Example: `tests/proposals/create-proposal.spec.ts`

## Imports
```typescript
import { test, expect } from '@selatropdev/selatrophub/web';
```
Never import from `@playwright/test`. Thaurus re-exports and extends Playwright's `test` and `expect`.

## Test File Structure
```typescript
import { test, expect } from '@selatropdev/selatrophub/web';

test.describe('{TestCase Name}', () => {
  // Precondition folder → beforeEach
  test.beforeEach(async ({ page }) => {
    // resolved precondition steps
  });

  // Process folder → test()
  test('{Scenario Name}', async ({ page }) => {
    // [Given] context setup
    // [When] user actions
    // [Then] assertions via expect()
  });

  // Data-driven (Scenario Outline equivalent)
  const testData = [
    { paramName: 'value1', anotherParam: 'valueA' },
    { paramName: 'value2', anotherParam: 'valueB' },
  ];
  for (const data of testData) {
    test(`{Scenario Name} - ${data.paramName}`, async ({ page }) => {
      // steps using data.paramName, data.anotherParam
    });
  }

  // Postcondition folder → afterEach (prefer API teardown)
  test.afterEach(async ({ page, request }) => {
    // cleanup steps
  });
});
```

## Step Writing Principles

**One action per line** — each `await` is one atomic interaction. Add a comment above logical groups:
```typescript
// [Given] User is logged in as Sales Manager
await page.goto('/login');
await page.fill('[name="username"]', testUser.username);

// [When] Create new proposal
await page.click('[data-testid="new-proposal-btn"]');

// [Then] Proposal appears in list
await expect(page.getByText('Proposal created')).toBeVisible();
```

**RTB = helper function or inline block** — An RTB chain of 15 leaf steps becomes either:
- An inline comment block if it only appears once: `// Create proposal for account` followed by the Playwright calls
- A named `async function` if the RTB is reused across multiple test cases

**Assertions are required** — Every `ActionMode=Verify` step MUST produce an `expect()` assertion. Never omit verifications.

**Assertions must have messages:**
```typescript
await expect(element, 'Cart badge should show updated item count').toHaveText('3');
```

**Semantic locators first** — Use `getByRole`, `getByLabel`, `getByText` over raw CSS/XPath.

**Infrastructure is invisible** — Login/session setup goes in `beforeEach`. Browser management, cache clearing → omit.

---

# Translation Workflow

**Phase 1 — Parse & Index**: Decompress TSU. Parse `Entities[]`. Build ALL four indexes. Flag any Surrogate referenced in associations that is missing from the map.

**Phase 2 — Discover & Classify**: Find all `TestCase` entities. For each, walk top-level `Items[]` and classify Precondition/Process/Postcondition. Identify all `TestStepFolderReference` (RTB calls) at every nesting level and count them.

**Phase 3 — Resolve RTB Chains (Exhaustively)**: For every `TestStepFolderReference`, resolve the full chain to leaf steps. Handle nested RTBs. Collect parameter bindings at each call site. Collect ALL data tokens. Classify: business logic vs. infrastructure. Build the complete ordered step sequence per test case section.

**Phase 4 — Resolve All Data**: Resolve every `{B[...]}`, `{XB[...]}`, `{TDS[...]}`, `{CP[...]}` token. Determine variable scopes (test-local vs. describe-scoped). Build `testData` arrays for data-driven tests. Verify zero remaining raw tokens.

**Phase 5 — Generate Playwright Code**: For each TestCase, create a `.spec.ts` file. Write `test.describe` with the test case name. Write `beforeEach` from preconditions. Write `test()` blocks for each Process section with inline comments. Write `expect()` assertions for every Verify action. Use `for...of` loops for parameterized scenarios. Write `afterEach` for postconditions (prefer API teardown via `request`).

**Phase 6 — Validate**:
- Every TestCase has a corresponding `.spec.ts` file
- Every `ActionMode=Verify` step has a corresponding `expect()` assertion
- Zero raw Tosca tokens in any generated code
- Zero infrastructure steps leaked into tests (unless meaningful)
- All locators are valid (semantic preferred, path-based as fallback)
- TypeScript compiles without errors:
  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```
- All data-driven scenarios use `testData` arrays
- Tests are independently runnable (no shared mutable state between `test()` blocks)

---

# Critical Rules

- NEVER generate a 1:1 Playwright call for each Tosca leaf action when they form a logical RTB. Group them under a comment describing the business action.
- ALWAYS resolve RTB chains to completion before generating code for that section.
- ALWAYS emit an `expect()` for every `ActionMode=Verify` step. No exceptions.
- USE semantic locators (`getByRole`, `getByLabel`, `getByText`) over raw selectors wherever possible.
- RESOLVE every data token. Zero raw Tosca tokens in the output.
- SCOPE variables correctly — buffers written in `beforeEach` need `let` at `describe` scope.
- OMIT pure infrastructure: browser management, TBox buffer ops, recovery scenarios, cache clearing.
- PREFER API teardown in `afterEach` over UI teardown for speed and reliability.
- IMPORT from `@selatropdev/selatrophub/web` — never from `@playwright/test` directly.
- INFER locator semantics from XModule/XModuleAttribute names — `AccountName` field → `page.getByLabel('Account Name')` or similar.

---

# Output Summary

After generating all files, print:
```
Tosca → Playwright conversion complete
Source: <tsu file>
Generated: <N> spec files
  tests/<suite>/<name>.spec.ts  (<M> tests)
  ...
TypeScript compile: PASS / <N errors>
```
