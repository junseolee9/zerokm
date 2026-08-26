import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  // Timeouts so a stalled SMTP handshake can't hold the serverless function until it dies
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout:   5000,
    socketTimeout:     8000,
  })
}

export async function sendPhotoNotification(uploaderName: string, recipientEmail: string, date: string) {
  const transporter = getTransporter()
  if (!transporter) return // email not configured — feature is optional

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const pretty = new Date(date + 'T12:00:00').toLocaleDateString('en', {
    month: 'long', day: 'numeric',
  })

  await transporter.sendMail({
    from: `"zerokm 💌" <${process.env.GMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Knock knock 🚪',
    html: `
      <div style="font-family: sans-serif; padding: 24px; max-width: 400px;">
        <h2 style="color: #e88a9a;">Knock knock 🚪</h2>
        <p><strong>${uploaderName}</strong> added a photo to your diary for <strong>${pretty}</strong>!</p>
        <p><a href="${appUrl}/?date=${date}" style="color: #e88a9a;">Come take a look</a></p>
      </div>
    `,
  })
}
