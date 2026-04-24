/** Minimal types when @selatropdev/selatrophub is not installed locally (CI / pack build). */
declare module '@selatropdev/selatrophub/web' {
  import type { PlaywrightTestConfig } from '@playwright/test'
  export function pwConfiguration(
    options: { timeout?: number; [k: string]: unknown }
  ): PlaywrightTestConfig
}
