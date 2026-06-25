import * as dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const [email, newPassword] = process.argv.slice(2)
if (!email || !newPassword) { console.error('Usage: npx tsx scripts/reset-password.ts <email> <password>'); process.exit(1) }

async function main() {
  const hash = await bcrypt.hash(newPassword, 12)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const result = await pool.query(
    `UPDATE "User" SET password = $1 WHERE email = $2 RETURNING id, name, email`,
    [hash, email.toLowerCase().trim()]
  )
  if (result.rowCount === 0) { console.error(`No user found: ${email}`); process.exit(1) }
  console.log('Password reset for:', result.rows[0])
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
