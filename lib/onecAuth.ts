// HTTP Basic Auth for the 1C CommerceML exchange endpoint (app/api/1c-exchange).
// Credentials are shared secrets entered identically into 1C's "Обмен данными с сайтом" wizard.

export function checkOnecAuth(req: Request): boolean {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Basic ')) return false

  let decoded: string
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8')
  } catch {
    return false
  }

  const sep = decoded.indexOf(':')
  if (sep === -1) return false
  const login = decoded.slice(0, sep)
  const password = decoded.slice(sep + 1)

  return login === process.env.ONEC_EXCHANGE_LOGIN && password === process.env.ONEC_EXCHANGE_PASSWORD
}

export function onecUnauthorizedResponse(): Response {
  return new Response('failure\nunauthorized', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="1C Exchange"',
    },
  })
}
