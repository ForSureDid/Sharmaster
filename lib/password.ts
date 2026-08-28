// Top breached/common passwords that still satisfy an 8-char length check
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty123', 'qwertyuiop', '11111111', '00000000', 'abc12345',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', 'sunshine1',
])

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Пароль должен быть не менее 8 символов'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Этот пароль слишком распространён, выберите другой'
  return null
}
