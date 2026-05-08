import path from 'path'
import fs from 'fs'
import { seedTestData, teardownTestData } from './helpers/seed'

export default async function globalSetup() {
  const seedData = await seedTestData()
  try {
    const outPath = path.join(process.cwd(), 'fixtures/seed-data.json')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(seedData, null, 2))
  } catch (err) {
    await teardownTestData(seedData).catch(() => {})
    throw err
  }
  console.log('✓ Test tenants seeded (dok-test, atl-test)')
}
