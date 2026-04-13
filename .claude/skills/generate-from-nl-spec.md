---
description: Generate a Jest TypeScript test file from a .nl.md spec using a two-pass pipeline (generate then self-critique and revise). Also creates or updates the .nl-manifest/manifest.json entry. Use when asked to "generate tests from spec", "run the NL pipeline on", or after writing a .nl.md file.
---

# Skill: Generate From NL Spec

You have been invoked via `/generate-from-nl-spec`.

## Input

The path to a `.nl.md` spec file. If not provided as an argument, ask: "Which `.nl.md` spec file should I generate tests from?"

---

## Pre-Flight

1. **Read the spec file.** Confirm it is a valid `.nl.md` with frontmatter.
2. **Parse frontmatter:** extract `module`, `layer`, `priority`, `version`, `tags`.
3. **Compute SHA256 of spec content:**
   ```bash
   node -e "const{createHash}=require('node:crypto'),fs=require('fs');console.log('sha256:'+createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'));" <spec-path>
   ```
4. **Determine output path:**
   - Spec at `src/auth/login.nl.md` → test at `src/auth/__tests__/login.test.ts`
   - Spec at `nl-specs/auth/login.nl.md` → test at `nl-specs/auth/__tests__/login.test.ts`
   - Rule: test goes in `__tests__/` sibling directory of the spec, same stem + `.test.ts`
5. **Check manifest** (invoke `/manage-nl-manifest` read operation for this specFile):
   - If entry exists AND `specHash` matches computed hash AND `status === 'current'`:
     Report: "Spec unchanged (version N, hash matches) — test is current. Increment `version` in the spec or pass `--force` to regenerate." **Stop.**
   - If `status === 'stale'`, or hash differs, or no entry: proceed to Pass 1.

---

## Pass 1 — Generate

Generate the Jest TypeScript test file from the spec behaviors.

### File Header (required)

```typescript
// @nl-spec: <relative-path-to-spec-from-project-root>
// @module: <module value from frontmatter>
// @layer: <layer value from frontmatter>
// @generated-by: claude-sonnet-4-6
// @spec-version: <version value from frontmatter>
```

### Imports

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
```

Never use `jest` global imports implicitly. Always import explicitly from `@jest/globals`.

### Structure

- One `describe()` block named after the `module` frontmatter value
- One `it()` block per behavior, named after the behavior description (the text after `Behavior N:`)
- Given content → `beforeEach()` if shared across multiple behaviors, or inline setup per test
- When content → the single action under test (function call, method invocation, or event)
- Then content → `expect()` assertions using the appropriate Jest matcher

### Matcher Selection

Map Then expressions to Jest matchers:

| Then Expression | Jest Matcher |
|---|---|
| `returns { field: value }` | `.toEqual({ field: value })` |
| `returns exactly value` | `.toBe(value)` |
| `matches /regex/` | `.toMatch(/regex/)` |
| `is true` / `is false` | `.toBe(true)` / `.toBe(false)` |
| `is truthy` / `is falsy` | `.toBeTruthy()` / `.toBeFalsy()` |
| `throws ErrorType with message "..."` | `.rejects.toThrow('...')` or `expect(() => fn()).toThrow(ErrorType)` |
| `does NOT do X` | `.not.toXxx()` |
| `contains item` | `.toContain(item)` or `.toEqual(expect.arrayContaining([item]))` |

### Layer-Specific Rules

**`layer: unit`**
- Mock ALL external dependencies (database, network, filesystem, other services)
- Test only pure logic
- No actual network calls, no actual DB writes

**`layer: integration`**
- Use real service calls where the spec specifies them
- Mock only third-party externals (external APIs, payment processors, etc.)
- Internal service-to-service calls may be real

### Assertion Messages

Where meaningful, include a failure message as the second argument:
```typescript
expect(result.success, 'login should succeed for valid credentials').toBe(true);
```

---

## Pass 2 — Self-Critique

After generating the Pass 1 file, perform a structured critique. Check all four dimensions:

### 1. Completeness
Is there an `it()` block for every behavior in the spec? Count spec behaviors vs. generated `it()` blocks.
- List any missing behaviors by name.

### 2. Edge Case Coverage
For negative/error behaviors: does the test assert both (a) the error condition AND (b) the absence of success side effects?
- Example: a test for "invalid password" should assert the error thrown AND that no session was created.

### 3. Assertion Quality
Are all `Then` items fully asserted? Flag:
- Behaviors with no `expect()` calls
- `expect()` calls with no matchers (`.toBe(undefined)` is suspicious)
- Overly broad matchers where specific values are available (use `.toBe('exact')` not `.toBeTruthy()` when exact value is known)

### 4. Mock Soundness
- For `unit`: are all I/O boundaries properly mocked? Any un-mocked `require`/`import` that touches real infrastructure?
- For `integration`: are only external-third-party calls mocked? Are internal calls real?

### Revision

If any deficiency is found, revise the generated file to address it. Output the final file followed by:
```
// Revision note: <brief summary of what changed in Pass 2>
```

If no deficiencies are found, output:
```
// Pass 2: no revisions needed
```

---

## Write the Test File

Write the final (Pass 2 revised) test file using the Write tool to the determined output path.

---

## Compute Test File Hash

```bash
node -e "const{createHash}=require('node:crypto'),fs=require('fs');console.log('sha256:'+createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'));" <test-path>
```

---

## Update Manifest

Invoke `/manage-nl-manifest` write operation with:

| Field | Value |
|---|---|
| `specFile` | relative path from project root |
| `specHash` | SHA256 computed in Pre-Flight |
| `testFile` | relative path from project root |
| `testHash` | SHA256 computed above |
| `combinedHash` | SHA256 of the concatenated string `specHash + testHash` |
| `status` | `current` |
| `generatedAt` | ISO 8601 timestamp (`new Date().toISOString()`) |
| `model` | `claude-sonnet-4-6` |

---

## Output Summary

```
NL Generation complete
Spec:       <spec-path> (version N, sha256:<short-hash>)
Test:       <test-path>
Behaviors:  N behaviors → N it() blocks
Pass 2:     No revisions needed | Revised: <brief note>
Manifest:   updated (status: current)
```
