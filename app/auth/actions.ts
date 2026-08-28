'use server'

import { db } from '@/lib/db'
import { setSession, clearSession, getSession, type SessionPayload } from '@/lib/session'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { validatePassword } from '@/lib/password'
import { sendPasswordResetEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function login(email: string, password: string): Promise<string | null> {
  const trimEmail = email.trim().toLowerCase()
  if (!await checkAuthRateLimit('login', trimEmail || undefined)) return 'Слишком много попыток. Подождите 15 минут.'

  if (!trimEmail || !password) return 'Укажите email и пароль'

  const user = await db.user.findUnique({ where: { email: trimEmail } })
  if (!user) return 'Неверный email или пароль'

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return 'Неверный email или пароль'

  await setSession({ userId: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role })
  return null
}

export async function register(
  name: string,
  email: string,
  phone: string,
  password: string
): Promise<string | null> {
  const trimEmail = email.trim().toLowerCase()
  if (!await checkAuthRateLimit('register', trimEmail || undefined)) return 'Слишком много попыток. Подождите 15 минут.'

  const trimName  = name.trim()
  const trimPhone = phone.trim()

  if (!trimName)  return 'Укажите имя'
  if (!trimEmail || !EMAIL_RE.test(trimEmail)) return 'Укажите корректный email'
  const pwError = validatePassword(password)
  if (pwError) return pwError

  const existing = await db.user.findUnique({ where: { email: trimEmail } })
  if (existing) return 'Не удалось создать аккаунт. Проверьте данные и попробуйте снова.'

  const hash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name: trimName, email: trimEmail, phone: trimPhone || null, password: hash },
  })

  await setSession({ userId: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role })
  return null
}

// Always returns null (no error) once the email is well-formed and rate
// limits pass — whether or not an account exists for that address is never
// revealed to the caller, so this can't be used to enumerate registered users.
export async function requestPasswordReset(email: string): Promise<string | null> {
  const trimEmail = email.trim().toLowerCase()
  if (!await checkAuthRateLimit('reset-request', trimEmail || undefined)) return 'Слишком много попыток. Подождите 15 минут.'
  if (!trimEmail || !EMAIL_RE.test(trimEmail)) return 'Укажите корректный email'

  const user = await db.user.findUnique({ where: { email: trimEmail } })
  if (user) {
    const token = randomBytes(32).toString('hex')
    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })
    try {
      await sendPasswordResetEmail(user.email, token)
    } catch (e) {
      console.error('Failed to send password reset email:', e)
    }
  }
  return null
}

export async function resetPassword(token: string, newPassword: string): Promise<string | null> {
  if (!await checkAuthRateLimit('reset-confirm', token)) return 'Слишком много попыток. Подождите 15 минут.'
  if (!token) return 'Ссылка для сброса пароля недействительна'

  const pwError = validatePassword(newPassword)
  if (pwError) return pwError

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return 'Ссылка для сброса пароля недействительна или устарела. Запросите новую.'
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { password: hash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }), // log out every existing session
  ])

  const user = await db.user.findUniqueOrThrow({ where: { id: record.userId } })
  await setSession({ userId: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role })
  return null
}

export async function logout(): Promise<void> {
  await clearSession()
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession()
}
