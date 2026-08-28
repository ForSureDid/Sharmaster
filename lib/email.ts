import { Resend } from 'resend'

const SITE_URL = 'https://www.sharmaster.kz'
const FROM = process.env.RESET_EMAIL_FROM || 'Sharmaster <noreply@sharmaster.kz>'

function getClient(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY env var is not set')
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`
  const resend = getClient()

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Сброс пароля — Sharmaster',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Сброс пароля</h2>
        <p>Мы получили запрос на сброс пароля для вашего аккаунта на sharmaster.kz.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#38bdf8;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Придумать новый пароль</a></p>
        <p>Ссылка действительна 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
      </div>
    `,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}
