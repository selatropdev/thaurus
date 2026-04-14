/// <reference path="./node_modules/@selatropdev/selatrophub/types/index.d.ts" />
/// <reference path="./node_modules/@selatropdev/selatrophub/types/globals.d.ts" />

import { Page } from '@playwright/test'

declare global {
    // Register page object factories here as they are created
    // Example:
    // let LoginPage: (page: Page) => import('./src/pages/LoginPage').LoginPage
}

export {};
