import { Router } from 'express';
import { db } from '../db/database.ts';
import { hashPassword, verifyPassword, generateToken, requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const authRouter = Router();

// Email format regex validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Register new user
authRouter.post('/register', (req, res) => {
  const { email, password, display_name, timezone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const now = new Date().toISOString();
  const userId = db.generateId('usr');
  const user = db.insertUser({
    id: userId,
    email: email.toLowerCase(),
    password_hash: hashPassword(password),
    display_name: display_name || email.split('@')[0],
    avatar_url: null,
    timezone: timezone || 'UTC',
    created_at: now,
    updated_at: now,
  });

  // Automatically provision default user settings and reminder configs
  db.upsertSettings(userId, { theme: 'dark', time_format: '24h', sound_enabled: true, notifications_enabled: true });
  db.upsertWaterConfig(userId, { enabled: true, interval_minutes: 45, start_time: '09:00', end_time: '18:00', duration_seconds: 120, active_days: [1, 2, 3, 4, 5] });
  db.upsertLookOutsideConfig(userId, { enabled: true, interval_minutes: 20, start_time: '09:00', end_time: '18:00', duration_seconds: 300, active_days: [1, 2, 3, 4, 5] });

  const token = generateToken(user);
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    token,
  });
});

// Login
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = generateToken(user);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    token,
  });
});

// Forgot Password - Initiate Reset Request
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const reset = db.createPasswordReset(user.email, 15);

  res.json({
    message: 'Password reset instructions sent to your email address.',
    reset_token: reset.token, // Returned for dev/test verification
    expires_at: reset.expires_at,
  });
});

// Reset Password - Complete with Reset Token
authRouter.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const validReset = db.getValidPasswordReset(token);
  if (!validReset) {
    return res.status(400).json({ error: 'Invalid or expired password reset token' });
  }

  const user = db.findUserByEmail(validReset.email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Update password hash and mark token as used
  db.updateUser(user.id, {
    password_hash: hashPassword(new_password),
  });
  db.markPasswordResetUsed(validReset.id);

  res.json({
    message: 'Password has been successfully reset. Please log in with your new password.',
  });
});

// Send / Resend Email Verification Code
authRouter.post('/send-verification', (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const verification = db.createEmailVerification(user.email, 30);

  res.json({
    message: 'Verification code sent to your email address.',
    code: verification.code, // Returned for dev/test verification
  });
});

// Verify Email Code
authRouter.post('/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const verified = db.verifyEmailCode(email, code);
  if (!verified) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  res.json({
    message: 'Email address successfully verified.',
    verified: true,
  });
});

// Get Current User Profile (Authenticated)
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.findUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  });
});

// Update Profile (Display Name, Avatar, Timezone)
authRouter.patch('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const { display_name, avatar_url, timezone } = req.body;

  if (timezone !== undefined && typeof timezone !== 'string') {
    return res.status(400).json({ error: 'Invalid timezone format' });
  }

  const updated = db.updateUser(req.user!.id, {
    ...(display_name !== undefined && { display_name: String(display_name).trim() || 'User' }),
    ...(avatar_url !== undefined && { avatar_url }),
    ...(timezone !== undefined && { timezone: String(timezone).trim() }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      display_name: updated.display_name,
      avatar_url: updated.avatar_url,
      timezone: updated.timezone,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  });
});

// Secure Email Change
authRouter.post('/change-email', requireAuth, (req: AuthenticatedRequest, res) => {
  const { new_email, current_password } = req.body;

  if (!new_email || !current_password) {
    return res.status(400).json({ error: 'New email and current password are required' });
  }

  if (!EMAIL_REGEX.test(new_email)) {
    return res.status(400).json({ error: 'Invalid new email address format' });
  }

  const user = db.findUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!verifyPassword(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }

  if (new_email.toLowerCase() === user.email.toLowerCase()) {
    return res.status(400).json({ error: 'New email address must be different from current email' });
  }

  const existing = db.findUserByEmail(new_email);
  if (existing && existing.id !== user.id) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const updated = db.updateUser(user.id, {
    email: new_email.toLowerCase(),
  });

  res.json({
    message: 'Email address updated successfully.',
    user: {
      id: updated!.id,
      email: updated!.email,
      display_name: updated!.display_name,
      avatar_url: updated!.avatar_url,
      timezone: updated!.timezone,
      created_at: updated!.created_at,
      updated_at: updated!.updated_at,
    },
  });
});

// Upload / Set Avatar
authRouter.post('/avatar', requireAuth, (req: AuthenticatedRequest, res) => {
  const { avatar_data } = req.body;

  if (!avatar_data) {
    return res.status(400).json({ error: 'Avatar data is required' });
  }

  // Size limit validation (e.g. max ~2.5MB base64 string)
  if (typeof avatar_data === 'string' && avatar_data.length > 3 * 1024 * 1024) {
    return res.status(400).json({ error: 'Avatar file size exceeds 2MB limit' });
  }

  // Validate format (data URL or standard image URL)
  if (typeof avatar_data === 'string' && !avatar_data.startsWith('data:image/') && !avatar_data.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid avatar image format. Must be PNG, JPEG, or WebP.' });
  }

  const updated = db.updateUser(req.user!.id, {
    avatar_url: avatar_data,
  });

  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    message: 'Avatar updated successfully.',
    avatar_url: updated.avatar_url,
  });
});

// Delete Account (Requires Password Verification)
authRouter.delete('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password confirmation is required to delete account' });
  }

  const user = db.findUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password. Account deletion cancelled.' });
  }

  const deleted = db.deleteUser(user.id);
  if (!deleted) {
    return res.status(500).json({ error: 'Failed to delete user account' });
  }

  res.json({
    message: 'User account and all associated data have been permanently deleted.',
    deleted: true,
  });
});
