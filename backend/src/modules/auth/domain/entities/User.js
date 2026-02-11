/**
 * User Entity
 * Core domain entity representing a user in the system
 */

import { Email } from '../valueObjects/Email.js';

export class User {
  #id;
  #email;
  #name;
  #displayName;
  #avatarUrl;
  #bio;
  #emailVerified;
  #isActive;
  #createdAt;
  #updatedAt;
  #lastLoginAt;

  /**
   * Create a User entity
   * @param {object} props - User properties
   */
  constructor(props) {
    this.#id = props.id;
    this.#email = props.email instanceof Email ? props.email : new Email(props.email);
    this.#name = props.name || null;
    this.#displayName = props.displayName || props.name || null;
    this.#avatarUrl = props.avatarUrl || null;
    this.#bio = props.bio || null;
    this.#emailVerified = props.emailVerified || false;
    this.#isActive = props.isActive !== undefined ? props.isActive : true;
    this.#createdAt = props.createdAt || new Date();
    this.#updatedAt = props.updatedAt || new Date();
    this.#lastLoginAt = props.lastLoginAt || null;
  }

  // Getters

  get id() {
    return this.#id;
  }

  get email() {
    return this.#email.value;
  }

  get emailObject() {
    return this.#email;
  }

  get name() {
    return this.#name;
  }

  get displayName() {
    return this.#displayName || this.#name || this.#email.getLocalPart();
  }

  get avatarUrl() {
    return this.#avatarUrl;
  }

  get bio() {
    return this.#bio;
  }

  get emailVerified() {
    return this.#emailVerified;
  }

  get isActive() {
    return this.#isActive;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get updatedAt() {
    return this.#updatedAt;
  }

  get lastLoginAt() {
    return this.#lastLoginAt;
  }

  // Domain methods

  /**
   * Verify the user's email
   */
  verifyEmail() {
    this.#emailVerified = true;
    this.#updatedAt = new Date();
  }

  /**
   * Update user profile
   * @param {object} updates - Profile updates
   */
  updateProfile(updates) {
    if (updates.name !== undefined) {
      this.#name = updates.name;
    }
    if (updates.displayName !== undefined) {
      this.#displayName = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      this.#avatarUrl = updates.avatarUrl;
    }
    if (updates.bio !== undefined) {
      this.#bio = updates.bio;
    }
    this.#updatedAt = new Date();
  }

  /**
   * Record a login
   */
  recordLogin() {
    this.#lastLoginAt = new Date();
    this.#updatedAt = new Date();
  }

  /**
   * Deactivate the user account
   */
  deactivate() {
    this.#isActive = false;
    this.#updatedAt = new Date();
  }

  /**
   * Reactivate the user account
   */
  reactivate() {
    this.#isActive = true;
    this.#updatedAt = new Date();
  }

  /**
   * Check if user can access premium features
   * @param {object} subscription - User subscription
   * @param {string} requiredTier - Required subscription tier
   * @returns {boolean}
   */
  canAccessFeature(subscription, requiredTier = 'PRO') {
    const tiers = ['FREE', 'PRO', 'BUSINESS'];
    const userTierIndex = tiers.indexOf(subscription?.tier || 'FREE');
    const requiredTierIndex = tiers.indexOf(requiredTier);
    return userTierIndex >= requiredTierIndex;
  }

  /**
   * Convert to plain object for persistence
   * @returns {object}
   */
  toPersistence() {
    return {
      id: this.#id,
      email: this.#email.value,
      name: this.#name,
      displayName: this.#displayName,
      avatarUrl: this.#avatarUrl,
      bio: this.#bio,
      emailVerified: this.#emailVerified,
      isActive: this.#isActive,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
      lastLoginAt: this.#lastLoginAt,
    };
  }

  /**
   * Convert to API response object
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#id,
      email: this.#email.value,
      name: this.#name,
      displayName: this.displayName,
      avatarUrl: this.#avatarUrl,
      bio: this.#bio,
      emailVerified: this.#emailVerified,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  /**
   * Create User entity from database record
   * @param {object} record - Database record
   * @returns {User}
   */
  static fromPersistence(record) {
    return new User({
      id: record.id,
      email: record.email,
      name: record.name,
      displayName: record.displayName,
      avatarUrl: record.avatarUrl,
      bio: record.bio,
      emailVerified: record.emailVerified,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastLoginAt: record.lastLoginAt,
    });
  }

  /**
   * Create a new User for registration
   * @param {object} props - User properties
   * @returns {User}
   */
  static create(props) {
    return new User({
      id: props.id || undefined,
      email: props.email,
      name: props.name || null,
      displayName: props.displayName || props.name || null,
      avatarUrl: props.avatarUrl || null,
      bio: props.bio || null,
      emailVerified: props.emailVerified || false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });
  }
}

export default User;
