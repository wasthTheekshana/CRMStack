import { test, expect, loadSeedData } from '../fixtures'
import { mintTestJwt, apiFetch } from '../helpers/api'

async function authedTeamActivityPage(
  browser: import('@playwright/test').Browser,
  subdomain: string, userId: string, tenantId: string, role: string, email: string,
) {
  const token = mintTestJwt({ userId, tenantId, role, email, plan: 'starter' })
  const ctx = await browser.newContext()
  await ctx.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain } }))
  await ctx.addCookies([{ name: 'auth_token', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto('/team-activity')
  return { page, ctx, token }
}

test.describe('Team Activity page', () => {
  test('admin sees the page heading and a logged activity', async ({ browser }) => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin } = seed.users
    const { page, ctx, token } = await authedTeamActivityPage(
      browser, dok.subdomain, dokAdmin.id, dok.id, 'admin', dokAdmin.email)
    try {
      // Seed an activity through the API so there is something to show
      await apiFetch('/api/activities', token, dok.subdomain, {
        method: 'POST',
        body: JSON.stringify({ type: 'call', description: 'Page test call activity' }),
      })
      await page.reload()
      await expect(page.getByTestId('team-activity-page')).toBeVisible()
      await expect(page.getByText('Page test call activity')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('sales user is redirected away from the admin page', async ({ browser }) => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokSales } = seed.users
    const { page, ctx } = await authedTeamActivityPage(
      browser, dok.subdomain, dokSales.id, dok.id, 'sales', dokSales.email)
    try {
      // RoleGuard should keep the admin page hidden from a sales user
      await expect(page.getByTestId('team-activity-page')).toHaveCount(0)
    } finally {
      await ctx.close()
    }
  })
})
