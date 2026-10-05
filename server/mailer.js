import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function isMailerConfigured() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  return Boolean(user && pass && pass.trim() !== '' && pass !== 'your_16char_app_password_here');
}

export function getTransporter() {
  if (!isMailerConfigured()) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER.trim(),
      pass: process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, ''), // strip spaces from Google 16-char code
    },
  });
}

/**
 * Send admin password-changed notification email.
 * @param {object} opts
 * @param {string} opts.adminName   - Full name of the admin
 * @param {string} opts.adminEmail  - Email address to notify
 * @param {string} opts.changedAt   - ISO timestamp of when the change happened
 */
export async function sendAdminPasswordChangedEmail({ adminName, adminEmail, changedAt }) {
  const transporter = getTransporter();
  if (!transporter) return; // silently skip if not configured

  const fromUser = (process.env.GMAIL_USER || '').trim();
  const formattedDate = new Date(changedAt).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const mailOptions = {
    from: `"Batuan NHS Voting System" <${fromUser}>`,
    to: adminEmail,
    subject: '🔐 Admin Password Changed — Batuan NHS Voting System',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Changed</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2563eb 100%);padding:36px 40px;text-align:center;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/DepEd_seal.png/200px-DepEd_seal.png"
                   alt="DepEd" width="60" style="margin-bottom:12px;border-radius:50%;"/>
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                Batuan National High School
              </h1>
              <p style="color:#93c5fd;margin:4px 0 0;font-size:14px;">Voting System — Security Alert</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
                    <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">⚠️ Security Notification</p>
                    <p style="margin:6px 0 0;color:#78350f;font-size:13px;">This is an automated message. If you did not make this change, contact your system administrator immediately.</p>
                  </td>
                </tr>
              </table>

              <p style="color:#374151;font-size:16px;margin:24px 0 8px;">Hello, <strong>${adminName}</strong>!</p>
              <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
                The administrator password for the <strong>Batuan NHS Voting System</strong> was successfully changed.
              </p>

              <!-- Detail card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color:#9ca3af;font-size:13px;width:140px;">Account</td>
                        <td style="color:#111827;font-size:14px;font-weight:600;">${adminEmail}</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:13px;">Changed on</td>
                        <td style="color:#111827;font-size:14px;">${formattedDate} (Philippine Time)</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:13px;">Changed by</td>
                        <td style="color:#111827;font-size:14px;">${adminName} (Admin)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 8px;">
                If you initiated this change, no further action is needed. Your current session remains active.
              </p>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
                If you did <strong style="color:#dc2626;">NOT</strong> make this change, please contact your IT administrator immediately.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Batuan National High School Voting System &bull; Automated Notification
              </p>
              <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">
                Do not reply to this email. This mailbox is not monitored.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[mailer] Password-change notification sent to ${adminEmail}`);
  } catch (err) {
    console.error('[mailer] Failed to send password-change email:', err.message);
  }
}

