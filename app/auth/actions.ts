'use server'

import { db } from '@/lib/db'
import { setSession, clearSession, getSession, type SessionPayload } from '@/lib/session'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Top breached/common passwords that still satisfy an 8-char length check
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty123', 'qwertyuiop', '11111111', '00000000', 'abc12345',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', 'sunshine1',
])

export async function login(email: string, password: string): Promise<string | null> {
  if (!await checkAuthRateLimit('login')) return 'Слишком много попыток. Подождите 15 минут.'

  const trimEmail = email.trim().toLowerCase()
  if (!trimEmail || !password) return 'Укажите email и пароль'

  const user = await db.user.findUnique({ where: { email: trimEmail } })
  if (!user) return 'Неверный email или пароль'

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return 'Неверный email или пароль'

  await setSession({ userId: user.id, name: user.name, email: user.email, phone: user.phone ?? null })
  return null
}

export async function register(
  name: string,
  email: string,
  phone: string,
  password: string
): Promise<string | null> {
  if (!await checkAuthRateLimit('register')) return 'Слишком много попыток. Подождите 15 минут.'

  const trimName  = name.trim()
  const trimEmail = email.trim().toLowerCase()
  const trimPhone = phone.trim()

  if (!trimName)  return 'Укажите имя'
  if (!trimEmail || !EMAIL_RE.test(trimEmail)) return 'Укажите корректный email'
  if (password.length < 8) return 'Пароль должен быть не менее 8 символов'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Этот пароль слишком распространён, выберите другой'

  const existing = await db.user.findUnique({ where: { email: trimEmail } })
  if (existing) return 'Не удалось создать аккаунт. Проверьте данные и попробуйте снова.'

  const hash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name: trimName, email: trimEmail, phone: trimPhone || null, password: hash },
  })

  await setSession({ userId: user.id, name: user.name, email: user.email, phone: user.phone ?? null })
  return null
}

export async function logout(): Promise<void> {
  await clearSession()
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession()
}
