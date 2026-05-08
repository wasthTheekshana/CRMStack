import { test as base, Page, BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import type { SeedData } from '../helpers/seed'

export { expect } from '@playwright/test'

export function loadSeedData(): SeedData {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures/seed-data.json'), 'utf-8')
  )
}

type Fixtures = {
  tenantPage:  (subdomain: string) => Promise<Page>
  authedPage:  (subdomain: string, email: string, password: string) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  tenantPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (subdomain) => {
      const ctx = await browser.newContext()
      contexts.push(ctx)
      const page = await ctx.newPage()
      await page.route('**/api/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain },
        })
      )
      return page
    })
    for (const ctx of contexts) await ctx.close()
  },

  authedPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (subdomain, email, password) => {
      const ctx = await browser.newContext()
      contexts.push(ctx)
      const page = await ctx.newPage()
      await page.route('**/api/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain },
        })
      )
      await page.goto('/login')
      await page.fill('#username', email)
      await page.fill('#password', password)
      await page.click('button[type="submit"]')
      await page.waitForURL('http://localhost:3000/')
      return page
    })
    for (const ctx of contexts) await ctx.close()
  },
})
