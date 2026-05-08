import { test, expect, loadSeedData } from '../fixtures'
import { apiLogin, apiFetch } from '../helpers/api'

test.describe('Settings security', () => {
  test('admin reads own settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('admin reads same-tenant sales user settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokSales.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('admin reads cross-tenant user settings — 403', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.atlAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(403)
  })

  test('sales user reads own settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokSales.email, seed.users.dokSales.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokSales.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('sales user reads another user settings — 403', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokSales.email, seed.users.dokSales.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(403)
  })
})
