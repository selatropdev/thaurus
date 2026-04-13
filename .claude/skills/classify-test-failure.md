---
description: Classify a test failure using the NL framework taxonomy (SOURCE_BUG | TEST_BUG | SELECTOR_STALE | SPEC_DRIFT | AMBIGUOUS) with a confidence score and evidence. Applies SOURCE_BUG guardrails before assigning that classification. Use when asked to "classify this failure", "what kind of failure is this", or as part of failure triage. Prefer Claude Opus 4.6 for highest classification accuracy.
---

# Skill: Classify Test Failure

You have been invoked via `/classify-test-failure`.

> **Model note:** Classification accuracy is highest with Claude Opus 4.6. If you are currently running on Sonnet, consider switching models with `/model opus` before proceeding — especially for SOURCE_BUG determinations where the ≥97% precision requirement applies.

---

## Required Inputs

Ask for any that are missing:

1. **Test run output** — pasted failure text or a path to a log file
2. **Spec file path** — `.nl.md` for unit/integration, `.feature` for E2E
3. **Test file path** — `.test.ts` or `.spec.ts`

Read both files before proceeding.

---

## Failure Classification Taxonomy

### `SOURCE_BUG`
The application code has a defect. The spec correctly describes the intended behavior, the test correctly implements the spec, and the application fails to satisfy the specified behavior. The failure is consistent, reproducible, and confirmable at the API or unit level independent of the test runner.

**Auto-action:** Never auto-heal. Always requires team lead approval before any rollback action.

### `TEST_BUG`
The test implementation is incorrect. The application behavior is correct and matches the spec, but the test makes an incorrect assertion, has a faulty mock setup, uses the wrong locator, or tests the wrong code path. The fix is entirely within the test file.

**Auto-action:** HIGH confidence → auto-heal the test. MEDIUM → suggest + confirm.

### `SELECTOR_STALE`
E2E tests only. A DOM locator or selector used in the test no longer matches an element in the current application. The application functionality is intact and correct; only the test's method of locating elements is stale. Confirm by checking that the element exists via a fresh snapshot.

**Auto-action:** HIGH confidence → auto-heal the selector. MEDIUM → suggest + confirm.

### `SPEC_DRIFT`
The spec (`.nl.md` or `.feature`) no longer reflects the current product behavior. The product changed intentionally (new feature, redesign, deliberate requirement change), making the old spec obsolete. The test correctly implements the spec; both spec and test need to be updated — but that decision belongs to the product owner.

**Auto-action:** Flag for product owner review. Do not modify tests or specs without PO input.

### `AMBIGUOUS`
The available evidence is insufficient to distinguish between two or more classifications with the required confidence. This is the correct classification when:
- Failure is intermittent or non-deterministic
- Evidence contradicts itself
- Both SOURCE_BUG and TEST_BUG are equally plausible
- Any SOURCE_BUG guardrail cannot be verified

**Auto-action:** Escalate to Workflow 1 (deep browser investigation) or to a human for ambiguous cases.

---

## Evidence Collection Protocol

Work through these steps to gather evidence before scoring:

1. **Map the failure to the spec** — identify which specific behavior (unit) or scenario (E2E) the test maps to. Confirm the test actually tests what the spec says.

2. **Determine where truth diverges** — is the actual value "wrong because the app is broken" or "wrong because the test expects the wrong thing"?

3. **E2E selector check** — for Playwright/WebdriverIO failures: does the target element exist in a fresh browser snapshot with a different selector? If yes → `SELECTOR_STALE` candidate.

4. **Unit mock audit** — for unit test failures: do the mocked return values accurately reflect how the real implementation would behave? Misaligned mocks are a common `TEST_BUG` signal.

5. **Determinism check** — run the failing test 2 more times (or check CI history). Intermittent → `AMBIGUOUS`.

6. **Peer test check** — search for other tests covering the same module/feature. Do they also fail? Multiple failures on the same feature → `SOURCE_BUG` signal.

---

## SOURCE_BUG Guardrail Checklist

**All five guardrails must pass before classifying as `SOURCE_BUG`.** If ANY guardrail is FAIL or CANNOT VERIFY, classify as `AMBIGUOUS` and note which guardrails failed.

Present this checklist whenever SOURCE_BUG is the result or a serious candidate:

```
SOURCE_BUG Guardrail Checklist:

1. Consistency
   Has the failure occurred in ≥3 consecutive runs (CI history or manual re-runs)?
   Result: PASS | FAIL | CANNOT VERIFY
   Evidence: <state evidence or "Unable to verify CI history">

2. Peer failure
   Does at least one other test covering the same feature also fail?
   Result: PASS | FAIL | CANNOT VERIFY
   Evidence: <list peer tests checked and their results>

3. Spec predates failure
   Was the spec file authored before this failure was first observed (≥1 release ago)?
   Check: git log --diff-filter=A -- <spec-file>
   Result: PASS | FAIL | CANNOT VERIFY
   Evidence: <spec creation date vs. estimated failure introduction date>

4. API-level confirmation
   Is the broken behavior confirmable at the API or unit level, not just through the UI/test layer?
   Result: PASS | FAIL | CANNOT VERIFY
   Evidence: <describe the API-level check performed or why it cannot be done>

5. Team lead approval
   Has the team lead approved this as SOURCE_BUG before rollback action is taken?
   Result: ALWAYS PENDING — requires human confirmation
   Note: This guardrail is never auto-satisfied. SOURCE_BUG confidence is treated as MEDIUM
         regardless of score because this guardrail always requires human sign-off.
```

---

## Confidence Scoring

Score confidence on a 0–100 scale based on:
- **Directness** of evidence linking failure to the classification
- **Number of corroborating signals**
- **Absence of contradicting signals**
- **Determinism** of the failure (consistent > intermittent)

### Confidence Bands and Actions

| Band | Score | Action |
|---|---|---|
| HIGH | ≥85 | Autonomous action eligible (except SOURCE_BUG — always MEDIUM) |
| MEDIUM | 60–84 | Suggest classification + fix, require human confirmation before action |
| LOW | <60 | Escalate to human — do not take autonomous action |

> **SOURCE_BUG exception:** SOURCE_BUG confidence is always treated as **MEDIUM** regardless of the computed score, because guardrail 5 (team lead approval) is always PENDING.

---

## Output Report

```markdown
## Failure Classification Report

Spec:       <path>
Test:       <path>
Failure:    <one-line failure summary: error type + message>

### Classification
Result:     SOURCE_BUG | TEST_BUG | SELECTOR_STALE | SPEC_DRIFT | AMBIGUOUS
Confidence: <score>/100 (HIGH | MEDIUM | LOW)

### Evidence
- SUPPORTING: <evidence item 1>
- SUPPORTING: <evidence item 2>
- CONTRADICTING: <evidence item, if any>

### SOURCE_BUG Guardrails
(include only when SOURCE_BUG is the result or was a serious candidate)

1. Consistency:        PASS | FAIL | CANNOT VERIFY — <note>
2. Peer failure:       PASS | FAIL | CANNOT VERIFY — <note>
3. Spec predates:      PASS | FAIL | CANNOT VERIFY — <note>
4. API confirmation:   PASS | FAIL | CANNOT VERIFY — <note>
5. Lead approval:      PENDING — requires human confirmation before any rollback

### Recommended Action
<one of the following based on classification + confidence band>
```

### Action Reference

| Classification | Confidence | Recommended Action |
|---|---|---|
| `TEST_BUG` | HIGH | Auto-heal the test |
| `TEST_BUG` | MEDIUM | Present fix suggestion, await confirmation |
| `SELECTOR_STALE` | HIGH | Auto-heal the selector |
| `SELECTOR_STALE` | MEDIUM | Present selector update, await confirmation |
| `SPEC_DRIFT` | Any | Flag for product owner review — do not modify test or spec |
| `SOURCE_BUG` | Any (treated as MEDIUM) | Escalate to team lead — create a Jira bug issue — do not auto-heal |
| `AMBIGUOUS` | Any | Invoke Workflow 1 (deep browser investigation) for more evidence |
| Any | LOW | Escalate to human with full context — do not take autonomous action |
