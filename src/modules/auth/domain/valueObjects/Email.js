/**
 * Email Value Object
 * Encapsulates email validation and normalization logic
 */

import { AppError } from '../../../../shared/errors/AppError.js';

export class Email {
  #value;

  /**
   * Create an Email value object
   * @param {string} email - Email address
   */
  constructor(email) {
    const normalized = Email.normalize(email);

    if (!Email.isValid(normalized)) {
      throw AppError.badRequest('Invalid email address');
    }

    this.#value = normalized;
  }

  /**
   * Get the email value
   * @returns {string}
   */
  get value() {
    return this.#value;
  }

  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.#value;
  }

  /**
   * Check equality with another Email
   * @param {Email} other - Another Email instance
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof Email)) {
      return false;
    }
    return this.#value === other.value;
  }

  /**
   * Get the domain part of the email
   * @returns {string}
   */
  getDomain() {
    return this.#value.split('@')[1];
  }

  /**
   * Get the local part of the email (before @)
   * @returns {string}
   */
  getLocalPart() {
    return this.#value.split('@')[0];
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  static isValid(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    // Additional checks
    const [localPart, domain] = email.split('@');

    // Local part length check
    if (localPart.length > 64) {
      return false;
    }

    // Domain length check
    if (domain.length > 255) {
      return false;
    }

    // Total length check
    if (email.length > 320) {
      return false;
    }

    return true;
  }

  /**
   * Normalize email address
   * - Lowercase
   * - Trim whitespace
   * @param {string} email - Email to normalize
   * @returns {string}
   */
  static normalize(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    return email.toLowerCase().trim();
  }

  /**
   * Create Email from string (factory method)
   * @param {string} email - Email string
   * @returns {Email|null}
   */
  static create(email) {
    try {
      return new Email(email);
    } catch {
      return null;
    }
  }
}

export default Email;
