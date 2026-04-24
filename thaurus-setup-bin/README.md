# thaurus-setup (npm wrapper)

Makes `npx thaurus-setup` work by delegating to `@selatropdev/thaurus` (GitHub Packages).

## One-time: publish to npm (author only)

If `npx thaurus-setup` returns 404, this package is not on the public registry yet.

```bash
npm login --registry https://registry.npmjs.org/
cd thaurus-setup-bin
npm version patch   # or match @selatropdev/thaurus version
npm publish --registry https://registry.npmjs.org/
```

(You may need OTP: `npm publish --otp=...` or a granular token with publish rights.)

## Everyone: run setup

**Before** the wrapper is published, use:

```bash
npx -p @selatropdev/thaurus@latest thaurus-setup
```

Or install the org package, then the binary is available:

```bash
npm install @selatropdev/thaurus@latest
npx thaurus-setup
```

GitHub Packages still requires a token with `read:packages` for `@selatropdev` in `~/.npmrc`.

**After** `thaurus-setup` is published to npmjs:

```bash
npx thaurus-setup
```

The wrapper will call `@selatropdev/thaurus` (same `version` in this package.json).

Keep **this package’s `version` field** in sync with `@selatropdev/thaurus` in the parent `package.json`.
