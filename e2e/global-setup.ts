import path from 'path'
import fs from 'fs'
import { seedTestData } from './helpers/seed'

export default async function globalSetup() {
  const seedData = await seedTestData()
  const outPath = path.join(process.cwd(), 'fixtures/seed-data.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(seedData, null, 2))
  console.log('✓ Test tenants seeded (dok-test, atl-test)')
}
