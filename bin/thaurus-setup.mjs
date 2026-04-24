#!/usr/bin/env node
/**
 * Thaurus project scaffold: ensures default folders and reminds about config.
 * Run: npx -p @selatropdev/thaurus thaurus-setup
 */
import { mkdir, writeFile, access, constants } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = process.cwd()

const dirs = [
  "src/tests/web",
  "src/data",
  "src/custom_modules/common/step_libraries",
  "src/custom_modules/web/page_objects",
  "src/pages",
  "context-docs",
]

const gitkeeps = dirs.map((d) => join(root, d, ".gitkeep"))

async function ensureDir(p) {
  await mkdir(p, { recursive: true })
}

async function ensureGitkeep(file) {
  try {
    await access(file, constants.F_OK)
  } catch {
    await writeFile(file, "", "utf8")
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: thaurus-setup [--force]

Scaffolds default Thaurus directories under the current working directory.
For install from GitHub Packages, add to .npmrc:
  @selatropdev:registry=https://npm.pkg.github.com/
  //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
Then: npm install @selatropdev/thaurus@latest
`)
    process.exit(0)
  }

  for (const d of dirs) {
    const full = join(root, d)
    await ensureDir(full)
  }
  for (const f of gitkeeps) {
    await ensureGitkeep(f)
  }

  console.log("Thaurus: created/verified folders under", root)
  console.log("Next: add Playwright + @selatropdev/selatrophub, then copy or merge playwright.config.ts and globals from the thaurus package.")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
