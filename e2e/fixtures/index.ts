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
      try {
        await page.goto('/login')
        await page.fill('#username', email)
        await page.fill('#password', password)
        const [loginRes] = await Promise.all([
          page.waitForResponse(r => r.url().includes('/api/auth/login')),
          page.click('button[type="submit"]'),
        ])
        if (loginRes.status() !== 200) {
          throw new Error(`authedPage login failed: HTTP ${loginRes.status()} for ${email} on subdomain "${subdomain}"`)
        }
        await page.waitForURL('/')
      } catch (err) {
        contexts.splice(contexts.indexOf(ctx), 1)
        await ctx.close()
        throw err
      }
      return page
    })
    for (const ctx of contexts) await ctx.close()
  },
})
