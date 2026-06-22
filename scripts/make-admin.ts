import * as dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'

const email = process.argv[2]
if (!email) { console.error('Usage: npx tsx scripts/make-admin.ts <email>'); process.exit(1) }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const result = await pool.query(
    `UPDATE "User" SET role = 'admin' WHERE email = $1 RETURNING id, name, email, role`,
    [email.toLowerCase().trim()]
  )
  if (result.rowCount === 0) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }
  console.log('Admin granted:', result.rows[0])
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
