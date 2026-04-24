// When @selatropdev/selatrophub is installed, those types apply; see typings/ for build without it.
/// <reference path="./typings/selatrophub-web.d.ts" />

import { Page } from '@playwright/test'

declare global {
    // Register page object factories here as they are created
    // Example:
    // let LoginPage: (page: Page) => import('./src/pages/LoginPage').LoginPage
}

export {};
