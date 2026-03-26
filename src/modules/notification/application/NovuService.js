/**
 * Novu Notification Service
 * Handles subscriber management and event triggering via Novu API
 */

import { Novu } from '@novu/api';
import config from '../../../config/index.js';

const NOVU_API_BASE = 'https://api.novu.co';
const novu = new Novu({
  secretKey: process.env.NOVU_API_KEY,
});

const WORKFLOW = {
  EMAIL_VERIFICATION: 'email-verification',
  WELCOME_EMAIL: 'welcome-email',
  PASSWORD_RESET: 'password-reset',
};

class NovuService {
  /**
   * Initialize or update a subscriber in Novu.
   * Uses direct REST call to bypass SDK response validation bug
   * (@novu/api v3 Zod schema mismatch with Novu API v2 response).
   */
  async initSubscriber(user) {
    try {
      const res = await fetch(`${NOVU_API_BASE}/v2/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `ApiKey ${process.env.NOVU_API_KEY}`,
        },
        body: JSON.stringify({
          subscriberId: user.id,
          firstName: user.name || user.displayName || '',
          email: user.email,
          data: { avatarUrl: user.avatarUrl || null },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Novu: initSubscriber failed (${res.status}):`, body);
      }
    } catch (error) {
      console.error('Novu: Failed to init subscriber:', error.message);
    }
  }

  /**
   * Remove a subscriber from Novu
   * Call on account deletion
   */
  async removeSubscriber(userId) {
    try {
      await novu.subscribers.delete(userId);
    } catch (error) {
      console.error('Novu: Failed to remove subscriber:', error.message);
    }
  }

  /**
   * Trigger a notification workflow
   * @param {string} workflowId - The workflow identifier
   * @param {string} subscriberId - The target subscriber ID
   * @param {object} payload - Data for the notification template
   * @param {string} [actorId] - The user who triggered the action
   */
  async trigger(workflowId, subscriberId, payload, actorId) {
    try {
      await novu.trigger({
        workflowId,
        to: subscriberId,
        payload,
        ...(actorId && { actor: actorId }),
      });
    } catch (error) {
      console.error(
        `Novu: Failed to trigger ${workflowId}:`,
        error.message
      );
    }
  }

  /**
   * Send email verification OTP via Novu
   * @param {string} subscriberId - User ID
   * @param {string} email - User email (fallback for subscriber creation)
   * @param {object} data - { otp, name }
   */
  async sendVerificationEmail(subscriberId, email, { otp, name }) {
    await this.triggerEmail(WORKFLOW.EMAIL_VERIFICATION, subscriberId, email, {
      otp,
      name: name || '',
      frontendUrl: config.frontendUrl,
    });
  }

  /**
   * Send welcome email via Novu
   * @param {string} subscriberId - User ID
   * @param {string} email - User email
   * @param {object} data - { name }
   */
  async sendWelcomeEmail(subscriberId, email, { name }) {
    await this.triggerEmail(WORKFLOW.WELCOME_EMAIL, subscriberId, email, {
      name: name || '',
      frontendUrl: config.frontendUrl,
    });
  }

  /**
   * Send password reset email via Novu
   * @param {string} subscriberId - User ID
   * @param {string} email - User email
   * @param {object} data - { resetUrl, name }
   */
  async sendPasswordResetEmail(subscriberId, email, { resetUrl, name }) {
    await this.triggerEmail(WORKFLOW.PASSWORD_RESET, subscriberId, email, {
      resetUrl,
      name: name || '',
      frontendUrl: config.frontendUrl,
    });
  }

  /**
   * Trigger an email workflow with subscriber fallback
   */
  async triggerEmail(workflowId, subscriberId, email, payload) {
    try {
      await novu.trigger({
        workflowId,
        to: { subscriberId, email },
        payload,
      });
    } catch (error) {
      console.error(
        `Novu: Failed to trigger ${workflowId} for ${email}:`,
        error.message,
      );
    }
  }

  /**
   * Trigger a notification to multiple subscribers
   * @param {string} workflowId - The workflow identifier
   * @param {string[]} subscriberIds - Array of subscriber IDs
   * @param {object} payload - Data for the notification template
   * @param {string} [actorId] - The user who triggered the action
   */
  async triggerBulk(workflowId, subscriberIds, payload, actorId) {
    const triggers = subscriberIds.map((subscriberId) => ({
      workflowId,
      to: subscriberId,
      payload,
      ...(actorId && { actor: actorId }),
    }));

    try {
      await novu.triggerBulk({ events: triggers });
    } catch (error) {
      console.error(
        `Novu: Failed to trigger bulk ${workflowId}:`,
        error.message
      );
    }
  }
}

export default new NovuService();
