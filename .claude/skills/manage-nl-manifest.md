---
description: Read, write, validate, update status, or list stale entries in .nl-manifest/manifest.json. Manages the NL framework cache: SHA256-based staleness detection, status lifecycle (current | stale | failed | pending), and manifest schema validation. Use when asked to "check the manifest", "update manifest status", "list stale specs", or invoked by other NL skills.
---

# Skill: Manage NL Manifest

You have been invoked via `/manage-nl-manifest`.

---

## Manifest Location Rule

The manifest always lives at:

```
{directory-of-spec-file}/.nl-manifest/manifest.json
```

Examples:
- Spec at `src/auth/login.nl.md` → manifest at `src/auth/.nl-manifest/manifest.json`
- Spec at `nl-specs/cart/checkout.nl.md` → manifest at `nl-specs/cart/.nl-manifest/manifest.json`

Multiple specs in the same directory share one manifest file via the `entries` array.

---

## Manifest JSON Schema

```json
{
  "schemaVersion": "1.0",
  "entries": [
    {
      "specFile": "src/auth/login.nl.md",
      "specHash": "sha256:<64-char-hex>",
      "testFile": "src/auth/__tests__/login.test.ts",
      "testHash": "sha256:<64-char-hex>",
      "combinedHash": "sha256:<64-char-hex>",
      "status": "current",
      "generatedAt": "2026-04-02T12:00:00.000Z",
      "model": "claude-sonnet-4-6"
    }
  ]
}
```

All file paths in `specFile` and `testFile` are **relative from the project root**.

Valid `status` values: `current` | `stale` | `failed` | `pending`

---

## SHA256 Computation

Use this Node.js command to compute the hash of any file:

```bash
node -e "const{createHash}=require('node:crypto'),fs=require('fs');console.log('sha256:'+createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'));" <file-path>
```

To compute a `combinedHash` from two existing hash strings:

```bash
node -e "const{createHash}=require('node:crypto');const specHash='sha256:<hex1>';const testHash='sha256:<hex2>';console.log('sha256:'+createHash('sha256').update(specHash+testHash).digest('hex'));"
```

---

## Operations

Infer the operation from context, or ask: "Which operation? `read`, `write`, `validate`, `update-status`, or `list-stale`?"

---

### Operation: `read`

Return the manifest entry for a given spec file.

**Input:** `specFile` path (relative from project root)

**Steps:**
1. Derive manifest path from `specFile` directory
2. If manifest file does not exist: report "No manifest found at `<path>`"
3. Parse JSON, find entry where `entry.specFile === specFile`
4. If found: return the full entry object
5. If not found: report "No manifest entry for `<specFile>`"

---

### Operation: `write`

Create or update a manifest entry.

**Input:** full entry object with all required fields.

**Required fields validation** (fail if any are missing or invalid):
- `specFile` — string, relative path ending in `.nl.md`
- `specHash` — string matching `sha256:[a-f0-9]{64}`
- `testFile` — string, relative path ending in `.test.ts`
- `testHash` — string matching `sha256:[a-f0-9]{64}`
- `combinedHash` — string matching `sha256:[a-f0-9]{64}`
- `status` — one of `current | stale | failed | pending`
- `generatedAt` — ISO 8601 timestamp
- `model` — non-empty string

**Steps:**
1. Validate all required fields. If invalid: report validation errors, do not write.
2. Derive manifest path from `specFile` directory.
3. If manifest file exists: read it, parse JSON, find and update (or append) the entry for this `specFile`.
4. If manifest file does not exist: create the `.nl-manifest/` directory, write new manifest with `entries: [entry]`.
5. Write the updated manifest JSON (2-space indented) using the Write tool.
6. Report: "Manifest updated: `<manifest-path>` — status: `<status>`"

---

### Operation: `validate`

Check manifest consistency by recomputing hashes and comparing to stored values.

**Steps:**
1. Find the manifest file (derive path from spec directory argument, or ask for the spec path)
2. For each entry in `entries`:
   a. Check if `specFile` exists on disk
   b. Check if `testFile` exists on disk
   c. If both exist: recompute `specHash` and `testHash` using the SHA256 command
   d. Compare computed hashes to stored hashes
3. Determine status for each entry:
   - Both hashes match: `CURRENT`
   - `specHash` differs, `testHash` same: `SPEC_CHANGED`
   - `testHash` differs, `specHash` same: `TEST_CHANGED`
   - Both hashes differ: `BOTH_CHANGED`
   - A file is missing: `MISSING_FILES`
4. Update `status` to `stale` for any entry that is not `CURRENT`
5. Write back the updated manifest

**Output:**
```
Manifest Validation: <manifest-path>

| Spec File | Test File | Stored Status | Computed Status | Action |
|---|---|---|---|---|
| auth/login.nl.md | auth/__tests__/login.test.ts | current | CURRENT | no change |
| cart/checkout.nl.md | cart/__tests__/checkout.test.ts | current | SPEC_CHANGED | → stale |

Summary: N entries — N current, N marked stale
```

---

### Operation: `update-status`

Update the `status` field for a specific entry.

**Input:** `specFile` path, new `status` value

**Validation:** `status` must be one of `current | stale | failed | pending`

**Steps:**
1. Read manifest
2. Find entry by `specFile`
3. Update `status`
4. Write manifest back
5. Report: "Status updated: `<specFile>` → `<new-status>`"

---

### Operation: `list-stale`

List all manifest entries across the project where `status !== 'current'`.

**Steps:**
1. Glob for all manifest files: `**/.nl-manifest/manifest.json` (exclude `node_modules`)
2. For each manifest file: read and collect entries where `status !== 'current'`
3. Output table:

```
Stale NL Specs

| Spec File | Test File | Status | Generated At | Model |
|---|---|---|---|---|
| <path> | <path> | stale | <timestamp> | <model> |

Total: N stale entries
Run /generate-from-nl-spec <path> for each stale spec to regenerate.
```

If no stale entries: report "All NL specs are current — no regeneration needed."
