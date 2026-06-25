import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// Prevent multiple instances in development (Next.js hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
