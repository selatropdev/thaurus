#!/usr/bin/env node
/**
 * Thin npx entry so `npx thaurus-setup` works from the public npm registry.
 * Delegates to @selatropdev/thaurus (GitHub Packages) — you still need
 * a GitHub token with read:packages in ~/.npmrc for that scope.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"))
const v = pkg.version
const npx = process.platform === "win32" ? "npx.cmd" : "npx"
const child = spawn(
  npx,
  ["-y", "-p", `@selatropdev/thaurus@${v}`, "thaurus-setup", ...process.argv.slice(2)],
  { stdio: "inherit", shell: process.platform === "win32", env: process.env }
)
child.on("close", (code) => process.exit(code ?? 0))
child.on("error", (e) => {
  console.error(e)
  process.exit(1)
})
