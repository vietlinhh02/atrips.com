/**
 * Novu Notification Service
 * Handles subscriber management and event triggering via Novu API
 */

import { Novu } from '@novu/api';

const novu = new Novu({
  secretKey: process.env.NOVU_API_KEY,
});

class NovuService {
  /**
   * Initialize or update a subscriber in Novu
   * Call on register and login to keep subscriber in sync
   */
  async initSubscriber(user) {
    try {
      await novu.subscribers.create({
        subscriberId: user.id,
        firstName: user.name || user.displayName || '',
        email: user.email,
        data: {
          avatarUrl: user.avatarUrl || null,
        },
      });
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
