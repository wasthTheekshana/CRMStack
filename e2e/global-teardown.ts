import path from 'path'
import fs from 'fs'
import { teardownTestData, SeedData } from './helpers/seed'

export default async function globalTeardown() {
  const seedPath = path.join(process.cwd(), 'fixtures/seed-data.json')
  if (!fs.existsSync(seedPath)) return
  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  await teardownTestData(seedData)
  fs.unlinkSync(seedPath)
  console.log('✓ Test tenants removed')
}
