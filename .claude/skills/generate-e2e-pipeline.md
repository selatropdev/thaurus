---
description: Three-stage E2E test generation pipeline from a Gherkin .feature file: (1) parse and plan POM structure, (2) generate TypeScript POM classes with semantic locators, (3) generate step definitions wired to POM methods. Routes output to Playwright (@modern), WebdriverIO mobile (@mobile), or defers @legacy. Use when asked to "generate E2E tests from a feature file", "run the E2E pipeline", or when POM architecture and step definitions are explicitly needed.
---

# Skill: Generate E2E Pipeline

You have been invoked via `/generate-e2e-pipeline`.

> This skill generates a **structured POM architecture** with separate step definitions — three distinct stages. Use the simpler `/convert-gherkin-to-playwright` skill when a flat, single-file Playwright spec is sufficient.

---

## Input

- `.feature` file path (required — ask if not provided)
- Runner tag: `@modern` (Playwright/web), `@mobile` (Appium/HeadSpin), `@legacy` (WebdriverIO/Selenium Grid)

---

## Runner Tag Detection

Before generating any code, determine the target runner.

**Detection order:**
1. Read the `.feature` file. Look for `@modern`, `@legacy`, or `@mobile` on the line(s) before `Feature:`.
2. If the user states a runner preference explicitly in their request, use that.
3. If no tag present and no preference stated, ask: "Which runner should I target? `@modern` (Playwright), `@mobile` (Appium/HeadSpin), or `@legacy` (WebdriverIO Selenium Grid)?" Default if no response: `@modern`.

### Runner Routing

| Tag | Target | Primary Import |
|---|---|---|
| `@modern` | Playwright / Chromium | `@playwright/test` |
| `@mobile` | Appium / HeadSpin (via WebdriverIO) | WebdriverIO + Appium (`$`, driver) |
| `@legacy` | WebdriverIO / Selenium Grid | **Deferred — Phase 6** |

**`@legacy` deferral:** State "WebdriverIO/Selenium Grid generation for `@legacy` tests is deferred to Phase 6. No code will be generated for this runner today. The feature file has been parsed and is ready for when @legacy generation is implemented." Then stop, unless the user asks to proceed with `@modern` as a fallback.

---

## Pre-Flight: Thaurus Project Check

For `@modern`: confirm `playwright.config.ts` exists and uses `defineConfig` from `@playwright/test`. If missing, run `npx -p @selatropdev/thaurus thaurus-setup` before proceeding.

For `@mobile`: confirm `wdio.conf.ts` (or equivalent) exists for WebdriverIO + Appium. If missing, note that mobile project scaffolding is required.

---

## Stage 1 — Parse and Plan

Parse the `.feature` file completely:
- `Feature:` name and all feature-level tags
- Each `Scenario:` / `Scenario Outline:` — name, tags, all Given/When/Then/And/But steps

**Identify page areas** implied by the steps:
- Navigation destinations (pages, views, screens)
- UI element interactions (inputs filled, buttons clicked, links followed)
- Assertions targeting specific elements (text content, visibility, counts, states)

**For each page area, identify the elements needed:**
- From `When` steps: elements to interact with (inputs, buttons, dropdowns, links)
- From `Then` steps: elements to assert on (text, counts, visibility, form state)
- From `Given`/`When I navigate` steps: page URLs or activation calls

**Derive method names** for each element interaction:
- Action: `async <verb><Noun>()` — e.g., `async fillEmailInput(email: string)`, `async clickSubmitButton()`
- Assertion: `async expect<State>()` — e.g., `async expectSuccessMessageVisible()`, `async expectErrorCount(n: number)`

**Print the Stage 1 Plan:**

```
### Stage 1 Plan
Feature:  <feature name>
Runner:   @modern | @mobile

Page Areas:
  <PageName> (used in N scenarios)
    Elements needed:
      - <element description> → <methodName>()
      ...

POM Files to Generate:
  @modern: src/custom_modules/web/page_objects/<page-name>.page.ts
  @mobile: src/custom_modules/mobile/page_objects/<page-name>.page.ts

Step Definition File:
  src/tests/<feature-kebab-name>/step-definitions/<feature-kebab-name>.steps.ts
```

Wait for user acknowledgment only if the plan identifies more than 5 page areas (likely scope creep). Otherwise proceed immediately.

---

## Stage 2 — Generate POMs

Generate a TypeScript POM class for each page area identified in Stage 1.

### `@modern` POM Template

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class <PageName>Page {
  private readonly page: Page;

  // Locators
  private readonly <elementName>: Locator;

  constructor(page: Page) {
    this.page = page;
    this.<elementName> = page.getByRole('<role>', { name: '<accessible name>' });
  }

  async <actionMethod>(<params>): Promise<void> {
    await this.<elementName>.<action>();
  }

  async expect<State>(<expected?>): Promise<void> {
    await expect(this.<elementName>, '<failure message describing expected state>').toBeVisible();
  }
}
```

### `@mobile` POM Template

```typescript
import { $ } from '@wdio/globals';

export class <PageName>Page {
  get <elementName>() {
    return $('~<accessibility-id>');
  }

  async <actionMethod>(<params>): Promise<void> {
    await (await this.<elementName>).click();
  }

  async expect<State>(): Promise<void> {
    await expect(await this.<elementName>).toBeDisplayed();
  }
}
```

### Locator Hierarchy (`@modern`)

1. `page.getByRole('<role>', { name: '<accessible name>' })` — preferred
2. `page.getByLabel('<label text>')`
3. `page.getByTestId('<data-testid>')`
4. `page.getByText('<visible text>')`
5. `page.locator('<css-selector>')` — last resort, document why

### Mobile Selector Hierarchy (`@mobile`)

1. `$('~<accessibility-id>')` — accessibility ID
2. `$('<ios-class-chain>')` / `$('<android-uiautomator>')` — platform-specific
3. `$('<xpath>')` — last resort

### POM Rules

- Each locator is a `private readonly` property initialized in the constructor (`@modern`)
- Action methods are `async`, named `<verb><Noun>`, return `Promise<void>`
- Assertion methods are `async`, named `expect<State>`, include a human-readable failure message as second arg to `expect()`
- No business logic in POMs — only element location and interaction
- No test-framework assertions outside assertion methods

### File Paths

- `@modern`: `src/custom_modules/web/page_objects/<page-kebab-name>.page.ts`
- `@mobile`: `src/custom_modules/mobile/page_objects/<page-kebab-name>.page.ts`

Write each POM file using the Write tool.

---

## Stage 3 — Generate Step Definitions

Wire every unique Gherkin step pattern to POM method calls.

### `@modern` Step Definition Template

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { <PageName>Page } from '../../custom_modules/web/page_objects/<page-name>.page';

let <pageName>Page: <PageName>Page;

Given('the user is on the {string} page', async function(pageName: string) {
  // initialize page object and navigate
});

When('the user fills in {string} with {string}', async function(field: string, value: string) {
  // delegate to POM
});

Then('the {string} should be visible', async function(elementName: string) {
  // delegate to POM assertion method
});
```

### `@mobile` Step Definition Template

Same Cucumber pattern, but import `$` from WebdriverIO (e.g. `@wdio/globals`) and delegate to mobile POM methods.

### Step Definition Rules

- **One definition per unique step pattern** — if the same action appears in 3 scenarios, it gets one step definition (not 3)
- **Use Cucumber expression parameters:** `{string}`, `{int}`, `{float}` — not regex unless Cucumber expressions can't express the pattern
- **Step text must match Gherkin exactly**, or use expression parameters where values vary
- **Each step calls ≤2 POM methods** — if more are needed, create a POM helper method
- **`And`/`But` steps** inherit the preceding step type (Given/When/Then) — implement accordingly
- **No raw Playwright/WebdriverIO** in step definitions — all browser interaction goes through POM methods
- **No assertions in When steps** — assertions belong in Then steps

### File Path

`src/tests/<feature-kebab-name>/step-definitions/<feature-kebab-name>.steps.ts`

Write the step definitions file using the Write tool.

---

## Output Summary

```
E2E Pipeline complete
Feature:  <feature-path>
Runner:   @modern | @mobile

Generated:
  POMs:
    + <pom-path> (<N> methods)
    ...
  Step Definitions:
    + <steps-path> (<N> step definitions)

Next: run your Cucumber/Playwright suite to verify the generated code compiles and step
      definitions bind correctly to the feature file.
```
