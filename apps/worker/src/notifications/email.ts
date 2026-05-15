import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter

  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'Email transport not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.',
    )
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  return _transporter
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@trade-tracker'

  await transporter.sendMail({ from, to, subject, html })
}
