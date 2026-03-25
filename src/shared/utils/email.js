/**
 * Email Utility
 * Handles sending transactional emails via SMTP
 * Design matches the atrips.me site: #073E71 primary, #F2F8FD surface
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import nodemailer from 'nodemailer';
import config from '../../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, '../assets/logo-email.png');
const LOGO_CID = 'logo@atrips.me';

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!config.email.user || !config.email.password) {
    console.warn(
      'Email service is not configured. Emails will be logged to console.',
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });

  return transporter;
}

const YEAR = new Date().getFullYear();

/**
 * Shared email layout wrapper matching atrips.me design system.
 * Uses logo image, navy header bar, and clean white card.
 * @param {string} content - Inner HTML content
 * @returns {string} Full HTML email
 */
function emailLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>ATrips</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F2F8FD;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#101010;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F8FD;">
    <tr>
      <td align="center" style="padding:32px 16px 48px 16px;">

        <!-- Logo -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="left" style="padding:0 0 24px 0;">
              <a href="${config.frontendUrl}" style="text-decoration:none;">
                <img src="cid:${LOGO_CID}" alt="ATRIPSME" width="160" style="display:block;border:0;height:auto;max-width:160px;" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ededed;">
          <!-- Navy accent bar -->
          <tr>
            <td style="height:4px;background-color:#073E71;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 36px 40px;">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:24px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${config.frontendUrl}" style="text-decoration:none;color:#878787;font-size:12px;">atrips.me</a>
                    <span style="color:#d6d6d6;padding:0 8px;">&middot;</span>
                    <a href="${config.frontendUrl}/help" style="text-decoration:none;color:#878787;font-size:12px;">Help Center</a>
                    <span style="color:#d6d6d6;padding:0 8px;">&middot;</span>
                    <a href="${config.frontendUrl}/privacy" style="text-decoration:none;color:#878787;font-size:12px;">Privacy</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:11px;color:#c2c2c2;line-height:1.6;">
                      &copy; ${YEAR} atrips.me &mdash; Your AI-powered travel companion.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send an email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 */
export async function sendEmail({ to, subject, html, text }) {
  const emailTransporter = getTransporter();

  const mailOptions = {
    from: config.email.from,
    to,
    subject,
    html,
    ...(text && { text }),
    attachments: [
      {
        filename: 'logo.png',
        path: LOGO_PATH,
        cid: LOGO_CID,
      },
    ],
  };

  if (!emailTransporter) {
    console.log('\n========== EMAIL (Development Mode) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text || html}`);
    console.log('================================================\n');
    return { messageId: 'dev-mode' };
  }

  try {
    const result = await emailTransporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

/**
 * Send email verification OTP
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} name - User name (optional)
 */
export async function sendVerificationEmail(email, otp, name = '') {
  const greeting = name ? name : 'there';
  const digits = otp.split('');

  const digitCells = digits
    .map(
      (d, i) =>
        `<td align="center" style="width:44px;height:52px;background-color:#F2F8FD;border:2px solid #073E71;border-radius:10px;${i < digits.length - 1 ? 'margin-right:6px;' : ''}">
          <span style="font-size:28px;font-weight:700;color:#073E71;font-family:'Courier New',Courier,monospace;line-height:52px;">${d}</span>
        </td>`,
    )
    .join(`\n        <td style="width:8px;"></td>\n        `);

  const html = emailLayout(`
              <!-- Icon -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:48px;height:48px;background-color:#F2F8FD;border-radius:12px;text-align:center;vertical-align:middle;">
                    <span style="font-size:24px;line-height:48px;">&#9993;</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:20px 0 8px 0;font-size:22px;font-weight:700;color:#101010;line-height:1.3;">
                Verify your email address
              </h1>
              <p style="margin:0 0 4px 0;font-size:15px;color:#606060;line-height:1.6;">
                Hi ${greeting}, thanks for signing up!
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#606060;line-height:1.6;">
                Enter this 6-digit code on the verification page to confirm your email:
              </p>

              <!-- OTP digits -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  ${digitCells}
                </tr>
              </table>

              <!-- Timer hint -->
              <p style="margin:20px 0 0 0;font-size:13px;color:#878787;text-align:center;line-height:1.5;">
                This code expires in <strong style="color:#606060;">24 hours</strong>
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 0 0 0;border-bottom:1px solid #ededed;"></td>
                </tr>
              </table>

              <!-- Security note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:20px 0 0 0;">
                    <p style="margin:0;font-size:12px;color:#c2c2c2;line-height:1.6;">
                      If you didn't create an account on atrips.me, you can safely ignore this email. No action is needed.
                    </p>
                  </td>
                </tr>
              </table>
  `);

  const text = `Hi ${greeting},

Thanks for signing up on atrips.me!

Your verification code is: ${otp}

Enter this code on the verification page to confirm your email address.

This code expires in 24 hours. If you didn't create this account, ignore this email.`.trim();

  await sendEmail({
    to: email,
    subject: `${otp} — your atrips.me verification code`,
    html,
    text,
  });
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} name - User name (optional)
 */
export async function sendPasswordResetEmail(email, token, name = '') {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const greeting = name ? name : 'there';

  const html = emailLayout(`
              <!-- Icon -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:48px;height:48px;background-color:#F2F8FD;border-radius:12px;text-align:center;vertical-align:middle;">
                    <span style="font-size:24px;line-height:48px;">&#128274;</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:20px 0 8px 0;font-size:22px;font-weight:700;color:#101010;line-height:1.3;">
                Reset your password
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;color:#606060;line-height:1.6;">
                Hi ${greeting}, we received a request to reset your password. Click the button below to choose a new one.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${resetUrl}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="23%" fillcolor="#073E71">
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Reset Password</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${resetUrl}" style="display:inline-block;background-color:#073E71;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 36px;border-radius:10px;min-width:180px;text-align:center;">
                      Reset Password
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 6px 0;font-size:12px;color:#878787;">Or copy and paste this link:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#F2F8FD;border-radius:8px;padding:12px 14px;">
                    <a href="${resetUrl}" style="font-size:12px;color:#073E71;word-break:break-all;text-decoration:none;">
                      ${resetUrl}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Timer hint -->
              <p style="margin:20px 0 0 0;font-size:13px;color:#878787;line-height:1.5;">
                This link expires in <strong style="color:#606060;">1 hour</strong>
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:24px 0 0 0;border-bottom:1px solid #ededed;"></td>
                </tr>
              </table>

              <!-- Security note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:20px 0 0 0;">
                    <p style="margin:0;font-size:12px;color:#c2c2c2;line-height:1.6;">
                      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>
  `);

  const text = `Hi ${greeting},

We received a request to reset your password. Click the link below:

${resetUrl}

This link expires in 1 hour. If you didn't request this, ignore this email.`.trim();

  await sendEmail({
    to: email,
    subject: 'Reset your atrips.me password',
    html,
    text,
  });
}

/**
 * Send welcome email after registration
 * @param {string} email - Recipient email
 * @param {string} name - User name (optional)
 */
export async function sendWelcomeEmail(email, name = '') {
  const greeting = name ? name : 'there';

  const features = [
    { icon: '&#9992;', title: 'AI Trip Planning', desc: 'Get personalized itineraries crafted by AI' },
    { icon: '&#127758;', title: 'Explore Destinations', desc: 'Discover places with local guides and tips' },
    { icon: '&#129309;', title: 'Travel Together', desc: 'Collaborate with friends on shared trips' },
    { icon: '&#128176;', title: 'Budget Tracking', desc: 'Keep track of expenses across currencies' },
  ];

  const featureRows = features
    .map(
      (f) => `
                <tr>
                  <td style="padding:14px 0;${f !== features[features.length - 1] ? 'border-bottom:1px solid #ededed;' : ''}">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:40px;height:40px;background-color:#F2F8FD;border-radius:10px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;line-height:40px;">${f.icon}</span>
                        </td>
                        <td style="padding-left:14px;">
                          <p style="margin:0;font-size:14px;font-weight:600;color:#101010;line-height:1.3;">${f.title}</p>
                          <p style="margin:2px 0 0 0;font-size:13px;color:#878787;line-height:1.4;">${f.desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`,
    )
    .join('');

  const html = emailLayout(`
              <!-- Icon -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:48px;height:48px;background-color:#F2F8FD;border-radius:12px;text-align:center;vertical-align:middle;">
                    <span style="font-size:24px;line-height:48px;">&#127881;</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:20px 0 8px 0;font-size:22px;font-weight:700;color:#101010;line-height:1.3;">
                Welcome to atrips.me!
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;color:#606060;line-height:1.6;">
                Hi ${greeting}, we're thrilled to have you on board. Here's everything you can do with your new account:
              </p>

              <!-- Feature list -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                ${featureRows}
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:4px 0 0 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${config.frontendUrl}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="23%" fillcolor="#073E71">
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Start Planning</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${config.frontendUrl}" style="display:inline-block;background-color:#073E71;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 36px;border-radius:10px;min-width:180px;text-align:center;">
                      Start Planning
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
  `);

  const text = `Hi ${greeting},

Welcome to atrips.me — your AI-powered travel companion!

Here's what you can do:
- AI Trip Planning: Get personalized itineraries crafted by AI
- Explore Destinations: Discover places with local guides and tips
- Travel Together: Collaborate with friends on shared trips
- Budget Tracking: Keep track of expenses across currencies

Get started at: ${config.frontendUrl}`.trim();

  await sendEmail({
    to: email,
    subject: 'Welcome to atrips.me!',
    html,
    text,
  });
}

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
