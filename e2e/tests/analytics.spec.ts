import { test, expect, loadSeedData } from '../fixtures'
import { mintTestJwt } from '../helpers/api'

/**
 * Each test creates a fresh browser context and injects the auth_token cookie
 * minted directly from the backend JWT_SECRET.  This completely avoids the
 * login-page rate-limiter (10 attempts / 15 min / IP) that fires when every
 * test submits the login form through the browser.
 */

async function getAuthedAnalyticsPage(
  browser: import('@playwright/test').Browser,
  subdomain: string,
  userId: string,
  tenantId: string,
  role: string,
  email: string,
  plan: string,
) {
  const token = mintTestJwt({ userId, tenantId, role, email, plan })
  const ctx = await browser.newContext()
  // Route API calls with the tenant subdomain header (mirrors authedPage fixture)
  await ctx.route('**/api/**', (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain },
    }),
  )
  // Inject the httpOnly auth_token cookie directly — no login form needed
  await ctx.addCookies([
    {
      name:     'auth_token',
      value:    token,
      domain:   'localhost',
      path:     '/',
      httpOnly: true,
      secure:   false,
      sameSite: 'Lax',
    },
  ])
  const page = await ctx.newPage()
  await page.goto('/analytics')
  return { page, ctx }
}

test.describe('Analytics drill-down', () => {
  test('clicking a legend row opens the leads sheet with matching title', async ({ browser }) => {
    const seed = loadSeedData()
    const { page, ctx } = await getAuthedAnalyticsPage(
      browser, 'dok-test',
      seed.users.dokAdmin.id, seed.tenants.dok.id, 'admin',
      seed.users.dokAdmin.email, 'starter',
    )
    try {
      // Click the first named solution in the custom legend
      const firstLegendItem = page.locator('p.text-xs.font-medium.text-gray-900').first()
      const solutionName = await firstLegendItem.textContent()
      await firstLegendItem.click()

      // Sheet should be visible with matching title
      // SheetTitle renders as DialogPrimitive.Title → <h2> (no data-slot in this shadcn version)
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('[role="dialog"] h2')).toHaveText(solutionName!)
    } finally {
      await ctx.close()
    }
  })

  test('sheet description shows correct lead count', async ({ browser }) => {
    const seed = loadSeedData()
    const { page, ctx } = await getAuthedAnalyticsPage(
      browser, 'dok-test',
      seed.users.dokAdmin.id, seed.tenants.dok.id, 'admin',
      seed.users.dokAdmin.email, 'starter',
    )
    try {
      await page.locator('p.text-xs.font-medium.text-gray-900').first().click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // SheetDescription renders as DialogPrimitive.Description → <p class="text-sm text-muted-foreground">
      // Each seeded solution has exactly 1 lead
      const description = page.locator('[role="dialog"] p.text-sm.text-muted-foreground')
      await expect(description).toContainText('1 lead')
    } finally {
      await ctx.close()
    }
  })

  test('clicking Others opens sheet with grouped leads', async ({ browser }) => {
    const seed = loadSeedData()
    const { page, ctx } = await getAuthedAnalyticsPage(
      browser, 'dok-test',
      seed.users.dokAdmin.id, seed.tenants.dok.id, 'admin',
      seed.users.dokAdmin.email, 'starter',
    )
    try {
      // "Others (2)" legend item — seeded 9 solutions, top 7 named + 2 in Others
      const othersItem = page.locator('p.text-xs.font-medium.text-gray-900', { hasText: /^Others \(\d+\)$/ })
      await expect(othersItem).toBeVisible()
      await othersItem.click()

      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('[role="dialog"] h2')).toContainText('Others')

      // Should show 2 leads (the 2 that didn't make top 7)
      const description = page.locator('[role="dialog"] p.text-sm.text-muted-foreground')
      await expect(description).toContainText('2 leads')
    } finally {
      await ctx.close()
    }
  })

  test('closing the sheet hides it', async ({ browser }) => {
    const seed = loadSeedData()
    const { page, ctx } = await getAuthedAnalyticsPage(
      browser, 'dok-test',
      seed.users.dokAdmin.id, seed.tenants.dok.id, 'admin',
      seed.users.dokAdmin.email, 'starter',
    )
    try {
      await page.locator('p.text-xs.font-medium.text-gray-900').first().click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // The SheetContent renders a close button with <span class="sr-only">Close</span>
      await page.getByRole('button', { name: 'Close' }).click()
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('can open a different slice after closing', async ({ browser }) => {
    const seed = loadSeedData()
    const { page, ctx } = await getAuthedAnalyticsPage(
      browser, 'dok-test',
      seed.users.dokAdmin.id, seed.tenants.dok.id, 'admin',
      seed.users.dokAdmin.email, 'starter',
    )
    try {
      const items = page.locator('p.text-xs.font-medium.text-gray-900')

      // Open first
      const first = await items.nth(0).textContent()
      await items.nth(0).click()
      await expect(page.locator('[role="dialog"] h2')).toHaveText(first!)

      // Close
      await page.getByRole('button', { name: 'Close' }).click()
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()

      // Open second
      const second = await items.nth(1).textContent()
      await items.nth(1).click()
      await expect(page.locator('[role="dialog"] h2')).toHaveText(second!)
    } finally {
      await ctx.close()
    }
  })
})
