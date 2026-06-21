import { test, expect, loadSeedData } from '../fixtures'
import { mintTestJwt, apiFetch } from '../helpers/api'

/**
 * Exercises the GET /api/activities filters. Activities are created via the API
 * as the admin and the sales user, then read back with various filters.
 * Auth uses minted JWTs (no login form → no rate limiter).
 */
test.describe('Team activity API filters', () => {
  test('admin sees all members; ownerId filters to one member; sales is scoped to self', async () => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin, dokSales } = seed.users
    const sub = dok.subdomain

    const adminToken = mintTestJwt({ userId: dokAdmin.id, tenantId: dok.id, role: 'admin', email: dokAdmin.email, plan: 'starter' })
    const salesToken = mintTestJwt({ userId: dokSales.id, tenantId: dok.id, role: 'sales', email: dokSales.email, plan: 'starter' })

    // Create one activity as admin and one as sales
    const mkAdmin = await apiFetch('/api/activities', adminToken, sub, {
      method: 'POST',
      body: JSON.stringify({ type: 'call', description: 'TA admin call' }),
    })
    expect(mkAdmin.status).toBe(201)
    const mkSales = await apiFetch('/api/activities', salesToken, sub, {
      method: 'POST',
      body: JSON.stringify({ type: 'meeting', description: 'TA sales meeting' }),
    })
    expect(mkSales.status).toBe(201)

    // Admin, no filter → sees both members' activities
    const allRes = await apiFetch('/api/activities', adminToken, sub)
    const all = await allRes.json()
    const allOwners = new Set(all.map((a: { ownerId: string }) => a.ownerId))
    expect(allOwners.has(dokAdmin.id)).toBeTruthy()
    expect(allOwners.has(dokSales.id)).toBeTruthy()

    // Admin, ownerId = sales → only sales' activities
    const oneRes = await apiFetch(`/api/activities?ownerId=${dokSales.id}`, adminToken, sub)
    const one = await oneRes.json()
    expect(one.length).toBeGreaterThan(0)
    expect(one.every((a: { ownerId: string }) => a.ownerId === dokSales.id)).toBeTruthy()

    // Sales passing admin's ownerId → still only own activities (IDOR guard)
    const sneakRes = await apiFetch(`/api/activities?ownerId=${dokAdmin.id}`, salesToken, sub)
    const sneak = await sneakRes.json()
    expect(sneak.length).toBeGreaterThan(0)
    expect(sneak.every((a: { ownerId: string }) => a.ownerId === dokSales.id)).toBeTruthy()
  })

  test('type filter narrows results and invalid type is rejected', async () => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin } = seed.users
    const sub = dok.subdomain
    const token = mintTestJwt({ userId: dokAdmin.id, tenantId: dok.id, role: 'admin', email: dokAdmin.email, plan: 'starter' })

    const typed = await apiFetch('/api/activities?type=meeting', token, sub)
    expect(typed.status).toBe(200)
    const rows = await typed.json()
    expect(rows.every((a: { type: string }) => a.type === 'meeting')).toBeTruthy()

    const bad = await apiFetch('/api/activities?type=bogus', token, sub)
    expect(bad.status).toBe(400)
  })
})
