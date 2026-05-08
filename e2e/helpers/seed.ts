import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })

function getDbClient() {
  return new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'dokcrm',
    user:     process.env.DB_USER     || 'dokcrm',
    password: process.env.DB_PASSWORD,
  })
}

export interface SeedData {
  tenants: {
    dok: { id: string; subdomain: string }
    atl: { id: string; subdomain: string }
  }
  users: {
    dokAdmin: { id: string; email: string; username: string; password: string }
    dokSales: { id: string; email: string; username: string; password: string }
    atlAdmin: { id: string; email: string; username: string; password: string }
    atlSales: { id: string; email: string; username: string; password: string }
  }
}

const PASSWORD = 'TestPass@123'

const SOLUTIONS = [
  'Alpha Suite', 'Beta Platform', 'Gamma Cloud', 'Delta Analytics',
  'Epsilon Connect', 'Zeta Secure', 'Eta Manager', 'Theta Insights', 'Iota Flow',
]

export async function seedTestData(): Promise<SeedData> {
  const client = getDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const hash = await bcrypt.hash(PASSWORD, 10)

    // Tenants
    const dokRes = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['DOK Test', 'dok-test', 'starter', 'active', 10, 'dok-test@test.com']
    )
    const atlRes = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['ATL Test', 'atl-test', 'starter', 'active', 10, 'atl-test@test.com']
    )
    const dokId = dokRes.rows[0].id as string
    const atlId = atlRes.rows[0].id as string

    // Users — dok-test
    const dokAdminRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['dok-admin@test.com', 'dok-admin-test', 'DOK Admin', hash, 'admin', dokId]
    )
    const dokSalesRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['dok-sales@test.com', 'dok-sales-test', 'DOK Sales', hash, 'sales', dokId]
    )

    // Users — atl-test
    const atlAdminRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['atl-admin@test.com', 'atl-admin-test', 'ATL Admin', hash, 'admin', atlId]
    )
    const atlSalesRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['atl-sales@test.com', 'atl-sales-test', 'ATL Sales', hash, 'sales', atlId]
    )

    const dokAdminId = dokAdminRes.rows[0].id as string

    // Leads for dok-test (9 distinct solutions → produces "Others (2)" bucket)
    for (const solution of SOLUTIONS) {
      await client.query(
        `INSERT INTO leads
           (company_name, solution, contacts, sales_stage, estimated_revenue,
            probability, owner_id, owner_email, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          `${solution} Corp`, solution, '[]', 'Meeting Pending',
          100000, 50, dokAdminId, 'dok-admin@test.com', dokId,
        ]
      )
    }

    await client.query('COMMIT')
    return {
      tenants: {
        dok: { id: dokId, subdomain: 'dok-test' },
        atl: { id: atlId, subdomain: 'atl-test' },
      },
      users: {
        dokAdmin: { id: dokAdminId,               email: 'dok-admin@test.com', username: 'dok-admin-test', password: PASSWORD },
        dokSales: { id: dokSalesRes.rows[0].id,   email: 'dok-sales@test.com', username: 'dok-sales-test', password: PASSWORD },
        atlAdmin: { id: atlAdminRes.rows[0].id,   email: 'atl-admin@test.com', username: 'atl-admin-test', password: PASSWORD },
        atlSales: { id: atlSalesRes.rows[0].id,   email: 'atl-sales@test.com', username: 'atl-sales-test', password: PASSWORD },
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

export async function teardownTestData(seedData: SeedData): Promise<void> {
  const client = getDbClient()
  await client.connect()
  try {
    await client.query(
      'DELETE FROM tenants WHERE id = ANY($1::uuid[])',
      [[seedData.tenants.dok.id, seedData.tenants.atl.id]]
    )
  } finally {
    await client.end()
  }
}
