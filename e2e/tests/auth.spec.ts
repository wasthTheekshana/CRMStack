import { test, expect, loadSeedData } from '../fixtures'

test.describe('Authentication', () => {
  test('valid login on correct tenant redirects to dashboard', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', seed.users.dokAdmin.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    await expect(page).toHaveURL('/')
  })

  test('invalid password shows error message', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', 'WrongPassword!')
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('dok credentials blocked on atl subdomain', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('atl-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', seed.users.dokAdmin.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('atl credentials blocked on dok subdomain', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.atlAdmin.email)
    await page.fill('#password', seed.users.atlAdmin.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('logout clears session and redirects to login', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    // Open user dropdown — trigger button shows display name "DOK Admin"
    await page.getByRole('button', { name: /DOK Admin/i }).click()
    await page.getByText('Sign Out').click()
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})
