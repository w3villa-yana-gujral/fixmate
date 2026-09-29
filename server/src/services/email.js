const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
})
const sender = process.env.SMTP_USER ? `FixMate <${process.env.SMTP_USER}>` : (process.env.EMAIL_FROM || 'FixMate <hello@fixmate.local>')

async function sendVerificationEmail(user, token) {
  const link = `${process.env.API_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`
  const html = `<div style="margin:0;background:#f4f1e9;padding:40px 16px;font-family:Arial,sans-serif;color:#24312d"><div style="max-width:560px;margin:auto;background:#fffefa;border:1px solid #e1ded5"><div style="padding:28px 32px;background:#173e38;color:#f8f4e9;font-size:24px;font-weight:700">+ fixmate</div><div style="padding:36px 32px"><p style="margin:0 0 10px;color:#b08b3d;font-size:11px;font-weight:700;letter-spacing:2px">WELCOME HOME</p><h1 style="margin:0 0 16px;font-size:28px;font-weight:500">Confirm your email</h1><p style="margin:0 0 24px;color:#68766d;font-size:15px;line-height:1.7">Hi ${user.name}, thanks for joining FixMate. Confirm your email address to activate your account and start booking trusted home services.</p><a href="${link}" style="display:inline-block;padding:14px 22px;background:#e4b95e;color:#173e38;text-decoration:none;font-size:13px;font-weight:700">Confirm my email</a><p style="margin:28px 0 0;color:#8b958d;font-size:12px;line-height:1.6">This link expires in 24 hours. If the button does not work, copy this link into your browser:<br /><a href="${link}" style="color:#527d6b;word-break:break-all">${link}</a></p></div></div></div>`
  if (!process.env.SMTP_HOST) {
    console.log(`[email preview] Verify ${user.email}: ${link}`)
    return
  }
  const result = await transporter.sendMail({
    from: sender,
    to: user.email,
    subject: 'Confirm your FixMate email',
    text: `Hi ${user.name}, confirm your FixMate email here: ${link}`,
    html
  })
  console.log(`[email sent] verification for ${user.email}: ${result.messageId}`)
}

async function sendAdminCodeEmail(email, code) {
  if (!process.env.SMTP_HOST) {
    console.log(`[email preview] Admin code for ${email}: ${code}`)
    return
  }
  await transporter.sendMail({ from: sender, to: email, subject: 'Your FixMate admin verification code', text: `Your FixMate admin signup code is ${code}. It expires in 10 minutes.` })
}

async function sendPasswordResetEmail(user, token) {
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}?reset_token=${token}`
  const html = `<div style="margin:0;background:#f4f1e9;padding:40px 16px;font-family:Arial,sans-serif;color:#24312d"><div style="max-width:560px;margin:auto;background:#fffefa;border:1px solid #e1ded5"><div style="padding:28px 32px;background:#173e38;color:#f8f4e9;font-size:24px;font-weight:700">+ fixmate</div><div style="padding:36px 32px"><p style="margin:0 0 10px;color:#b08b3d;font-size:11px;font-weight:700;letter-spacing:2px">ACCOUNT SECURITY</p><h1 style="margin:0 0 16px;font-size:28px;font-weight:500">Reset your password</h1><p style="margin:0 0 24px;color:#68766d;font-size:15px;line-height:1.7">We received a request to reset your FixMate password. Use the button below to choose a new one.</p><a href="${link}" style="display:inline-block;padding:14px 22px;background:#e4b95e;color:#173e38;text-decoration:none;font-size:13px;font-weight:700">Reset my password</a><p style="margin:28px 0 0;color:#8b958d;font-size:12px;line-height:1.6">This link expires in 15 minutes. If you did not request this, you can safely ignore this email.</p></div></div></div>`
  if (!process.env.SMTP_HOST) {
    console.log(`[email preview] Reset password for ${user.email}: ${link}`)
    return
  }
  await transporter.sendMail({ from: sender, to: user.email, subject: 'Reset your FixMate password', text: `Reset your FixMate password here: ${link}. This link expires in 15 minutes.`, html })
}

module.exports = { sendVerificationEmail, sendAdminCodeEmail, sendPasswordResetEmail }
