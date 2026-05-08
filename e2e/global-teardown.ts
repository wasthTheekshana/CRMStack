import path from 'path'
import fs from 'fs'
import { teardownTestData, SeedData } from './helpers/seed'

export default async function globalTeardown() {
  const seedPath = path.join(process.cwd(), 'fixtures/seed-data.json')
  if (!fs.existsSync(seedPath)) return
  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  try {
    await teardownTestData(seedData)
    console.log('✓ Test tenants removed')
  } finally {
    fs.unlinkSync(seedPath)
  }
}
