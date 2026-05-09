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

export async function sendTrialExpiryWarningEmail(
  to: string,
  tenantName: string,
  daysLeft: number
): Promise<void> {
  const urgency = daysLeft <= 2 ? '⚠️ Urgent: ' : '';
  const subject = `${urgency}Your free trial expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — ${tenantName}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject,
    text: [
      `Hello,`,
      ``,
      `This is a reminder that your free trial for ${tenantName} on DOK CRM will expire in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      ``,
      `To keep uninterrupted access to your account, please contact us to upgrade to a paid plan before your trial ends.`,
      ``,
      `If you have any questions, reply to this email or contact support@crmstack.com.`,
      ``,
      `— The DOK CRM Team`,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#4f46e5;">Free Trial Expiring Soon</h2>
        <p>Hello,</p>
        <p>Your free trial for <strong>${tenantName}</strong> on DOK CRM will expire in
           <strong style="color:${daysLeft <= 2 ? '#dc2626' : '#d97706'};">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
        <p>To keep uninterrupted access, please contact us to upgrade to a paid plan before your trial ends.</p>
        <p style="color:#6b7280;font-size:14px;">
          Questions? Reply to this email or contact
          <a href="mailto:support@crmstack.com">support@crmstack.com</a>.
        </p>
        <p style="color:#9ca3af;font-size:12px;">— The DOK CRM Team</p>
      </div>
    `,
  });
}

export async function sendTrialExpiredEmail(to: string, tenantName: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject: `Your free trial has ended — ${tenantName}`,
    text: [
      `Hello,`,
      ``,
      `Your free trial for ${tenantName} on DOK CRM has ended and your account has been suspended.`,
      ``,
      `To reactivate your account, please contact us at support@crmstack.com.`,
      ``,
      `— The DOK CRM Team`,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#dc2626;">Free Trial Ended</h2>
        <p>Hello,</p>
        <p>Your free trial for <strong>${tenantName}</strong> on DOK CRM has ended and your account has been
           <strong>suspended</strong>.</p>
        <p>To reactivate your account, please contact us at
           <a href="mailto:support@crmstack.com">support@crmstack.com</a>.</p>
        <p style="color:#9ca3af;font-size:12px;">— The DOK CRM Team</p>
      </div>
    `,
  });
}

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
