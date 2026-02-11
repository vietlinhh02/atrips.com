/**
 * Passport.js Configuration
 * Google OAuth 2.0 Strategy
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './index.js';

/**
 * Configure Google OAuth Strategy
 * @param {Function} verifyCallback - Callback to verify/create user
 */
export function configureGoogleStrategy(verifyCallback) {
  if (!config.google.clientId || !config.google.clientSecret) {
    console.warn('Google OAuth is not configured. Skipping Google strategy setup.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        scope: ['profile', 'email'],
        passReqToCallback: true,
      },
      verifyCallback
    )
  );
}

/**
 * Serialize user for session
 * Since we use JWT tokens, this is minimal
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser((id, done) => {
  // For stateless JWT auth, we don't need to fully deserialize
  done(null, { id });
});

export default passport;
