#!/usr/bin/env node
/**
 * Thaurus QA automation CLI for the selatropdev org.
 * Installs Playwright + TypeScript, scaffolds config and src.
 *
 * Run: npx -p @selatropdev/thaurus@latest thaurus-setup
 * Or:  npm install @selatropdev/thaurus@latest && npx thaurus-setup
 */
import { mkdir, writeFile, readFile, access, copyFile } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { spawn } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
/** templates ship next to this file in the published package */
const templateRoot = join(__dirname, "..")

const root = process.cwd()

const DIRS = [
  "src/tests/web",
  "src/data",
  "src/config",
  "src/custom_modules/common/step_libraries",
  "src/custom_modules/web/page_objects",
  "src/pages",
  "context-docs",
]

const DEV_DEPS = {
  "@playwright/test": "^1.57.0",
  "@types/node": "^24.0.0",
  typescript: "^6.0.2",
}

const NPMRC_LINES = [
  "@selatropdev:registry=https://npm.pkg.github.com/",
  "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}",
  "",
  "# Or paste a PAT: //npm.pkg.github.com/:_authToken=ghp_xxx",
  "# Needs read:packages (install) and write:packages (publish). Authorize SSO for org if required.",
]

const GITIGNORE = `.env
.env.*.local
node_modules/
out/
dist/
allure-results/
allure-report/
playwright-report/
test-results/
.playwright-mcp/
*.log
*.tgz
`

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))
    })
    child.on("error", reject)
  })
}

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function writeFileUnlessExists(relPath, content, force) {
  const full = join(root, relPath)
  if (!force && (await pathExists(full))) {
    console.log("  skip (exists):", relPath)
    return
  }
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content, "utf8")
  console.log("  write:", relPath)
}

/** Copy from published package templates when available; else inline fallback */
async function copyOrWrite(relPath, fallbackContent, force) {
  const packaged = join(templateRoot, relPath)
  const full = join(root, relPath)
  if (!force && (await pathExists(full))) {
    console.log("  skip (exists):", relPath)
    return
  }
  await mkdir(dirname(full), { recursive: true })
  if (await pathExists(packaged)) {
    await copyFile(packaged, full)
    console.log("  copy:", relPath)
  } else {
    await writeFile(full, fallbackContent, "utf8")
    console.log("  write:", relPath, "(inline)")
  }
}

async function mergeOrCreatePackageJson(force) {
  const pkgPath = join(root, "package.json")
  let pkg = {
    name: "thaurus-qa",
    version: "1.0.0",
    private: true,
    type: "module",
    description: "Thaurus QA automation",
    scripts: {
      test: "playwright test",
      "test:headed": "playwright test --headed",
      "test:debug": "playwright test --debug",
      build: "tsc --noEmit",
    },
  }
  if (await pathExists(pkgPath)) {
    const raw = await readFile(pkgPath, "utf8")
    try {
      pkg = { ...JSON.parse(raw) }
    } catch (e) {
      console.error("Invalid package.json — fix JSON and re-run thaurus-setup.")
      process.exit(1)
    }
  } else {
    try {
      const base = root.split(/[/\\]/).filter(Boolean).pop() || "thaurus-qa"
      pkg.name = base.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "thaurus-qa"
    } catch {
      pkg.name = "thaurus-qa"
    }
  }
  pkg.type = "module"
  pkg.scripts = {
    test: "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    build: "tsc --noEmit",
    ...(pkg.scripts || {}),
  }
  pkg.dependencies = { ...(pkg.dependencies || {}) }
  pkg.devDependencies = { ...DEV_DEPS, ...pkg.devDependencies }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8")
  console.log("  update: package.json")
}

async function ensureNpmrc(force) {
  const p = join(root, ".npmrc")
  if (!force && (await pathExists(p))) {
    console.log("  keep existing: .npmrc (add GitHub token if installs fail)")
    return
  }
  await writeFile(p, NPMRC_LINES.join("\n"), "utf8")
  console.log("  write: .npmrc (set GITHUB_TOKEN or token line for @selatropdev packages)")
}

async function ensureGitignore(force) {
  const p = join(root, ".gitignore")
  if (!force && (await pathExists(p))) return
  await writeFile(p, GITIGNORE, "utf8")
  console.log("  write: .gitignore")
}

async function scaffoldDirs() {
  for (const d of DIRS) {
    await mkdir(join(root, d), { recursive: true })
  }
  for (const d of DIRS) {
    if (d === "src/config") continue
    const g = join(root, d, ".gitkeep")
    if (!(await pathExists(g))) await writeFile(g, "", "utf8")
  }
}

const INLINE_PLAYWRIGHT = `import './src/globals'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 30000,
})
`

const INLINE_TSCONFIG = `{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2024"],
    "types": ["node", "@playwright/test"],
    "outDir": "out",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "strict": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true
  },
  "include": ["src", "playwright.config.ts", "globals.d.ts"],
  "exclude": ["node_modules", "out"]
}
`

const INLINE_GLOBALS_DTS = `import { Page } from '@playwright/test'

declare global {
    // Register page object factories here as they are created
    // Example:
    // let LoginPage: (page: Page) => import('./src/pages/LoginPage').LoginPage
}

export {};
`

const INLINE_GLOBALS = `import { Page } from "@playwright/test";

// Register page object factories here as they are created.
// Example:
// import { LoginPage as _LoginPage } from "./pages/LoginPage";
// (globalThis as any).LoginPage = (page: Page) => new _LoginPage(page)

export {};
`

const INLINE_CRED = `export const credentials: Record<string, { username: string; password: string }> = {
    // Add user credential aliases here
    // admin: { username: 'admin@example.com', password: 'secret' },
}
`

const INLINE_ENV = `export const environment = {
    baseUrl: process.env.BASE_URL ?? '',
}
`

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes("--force")
  const skipInstall = args.includes("--skip-install")
  const skipBrowsers = args.includes("--skip-browsers")

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`thaurus-setup — QA automation scaffold (TypeScript + Playwright + Thaurus)

Usage:
  npx -p @selatropdev/thaurus@latest thaurus-setup
  npx thaurus-setup              # after: npm i @selatropdev/thaurus
  npx thaurus-setup              # also works if the "thaurus-setup" package is published on npmjs (see thaurus-setup-bin/ in the repo)

Options:
  --force         Overwrite config files and .npmrc
  --skip-install  Only create files; do not run npm install
  --skip-browsers Do not run playwright install (browser download)

Before install: ensure .npmrc can read GitHub Packages for @selatropdev, e.g.:
  export GITHUB_TOKEN=ghp_xxx   # or set token in .npmrc
`)
    process.exit(0)
  }

  console.log("Thaurus setup in:", root)
  await scaffoldDirs()
  await ensureGitignore(force)
  await ensureNpmrc(force)

  await copyOrWrite("playwright.config.ts", INLINE_PLAYWRIGHT, force)
  await copyOrWrite("tsconfig.json", INLINE_TSCONFIG, force)
  await copyOrWrite("globals.d.ts", INLINE_GLOBALS_DTS, force)
  await writeFileUnlessExists("src/globals.ts", INLINE_GLOBALS, force)
  await writeFileUnlessExists("src/config/credentials.ts", INLINE_CRED, force)
  await writeFileUnlessExists("src/config/environment.ts", INLINE_ENV, force)

  await mergeOrCreatePackageJson(force)

  if (skipInstall) {
    console.log("\nDone (--skip-install). Run: npm install && npx playwright install")
    process.exit(0)
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm"
  const npx = process.platform === "win32" ? "npx.cmd" : "npx"
  try {
    console.log("\nRunning: npm install …")
    await run(npm, ["install"], { cwd: root, shell: true })
  } catch (e) {
    console.error("\n" + e.message)
    console.error(
      "Fix: set GITHUB_TOKEN (read:packages) or add //npm.pkg.github.com/:_authToken= to .npmrc, then: npm install"
    )
    process.exit(1)
  }

  if (!skipBrowsers) {
    try {
      console.log("\nRunning: npx playwright install …")
      await run(npx, ["playwright", "install"], { cwd: root, shell: true })
    } catch (e) {
      console.warn("playwright install warning:", e.message)
      console.warn("Run manually: npx playwright install")
    }
  }

  console.log("\nThaurus setup complete. Run: npm test")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
