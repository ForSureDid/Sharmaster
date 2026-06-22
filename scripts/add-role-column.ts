import * as dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`)
  console.log('Done: role column added')
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
