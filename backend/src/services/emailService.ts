import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST!,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM!,
    to,
    subject: 'Reset your DOK CRM password',
    text: [
      'You requested a password reset for your DOK CRM account.',
      '',
      'Click the link below to set a new password. This link expires in 1 hour.',
      '',
      resetLink,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#4f46e5;">Reset your DOK CRM password</h2>
        <p>You requested a password reset for your DOK CRM account.</p>
        <p>Click the button below to set a new password.
           This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 24px;background:#4f46e5;
                  color:#fff;border-radius:6px;text-decoration:none;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:14px;">
          If you did not request this, you can safely ignore this email.
        </p>
        <p style="color:#9ca3af;font-size:12px;">
          Or copy this link: ${resetLink}
        </p>
      </div>
    `,
  });
}
