/**
 * Email Utility
 * Handles sending transactional emails via SMTP
 */

import nodemailer from 'nodemailer';
import config from '../../config/index.js';

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!config.email.user || !config.email.password) {
    console.warn('Email service is not configured. Emails will be logged to console.');
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
  };

  // In development without SMTP config, log to console
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
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} name - User name (optional)
 */
export async function sendVerificationEmail(email, token, name = '') {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">ATrips</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>${greeting}</p>
        <p>Thank you for signing up for ATrips! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background: #eee; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">
          ${verificationUrl}
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you didn't create an account with ATrips, please ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
${greeting}

Thank you for signing up for ATrips! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with ATrips, please ignore this email.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Verify your ATrips email address',
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
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">ATrips</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>${greeting}</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background: #eee; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">
          ${resetUrl}
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
${greeting}

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Reset your ATrips password',
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
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ATrips</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to ATrips!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>${greeting}</p>
        <p>Welcome to ATrips - your AI-powered travel companion! We're excited to have you on board.</p>
        <h3>Here's what you can do:</h3>
        <ul style="padding-left: 20px;">
          <li>Plan trips with AI assistance</li>
          <li>Discover amazing places and local guides</li>
          <li>Collaborate with friends on trip planning</li>
          <li>Track your budget and expenses</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.frontendUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Start Planning
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Need help? Contact us at support@atrips.com
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
${greeting}

Welcome to ATrips - your AI-powered travel companion! We're excited to have you on board.

Here's what you can do:
- Plan trips with AI assistance
- Discover amazing places and local guides
- Collaborate with friends on trip planning
- Track your budget and expenses

Get started at: ${config.frontendUrl}

Need help? Contact us at support@atrips.com
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Welcome to ATrips!',
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
