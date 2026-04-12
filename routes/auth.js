const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendWhatsApp = require('../utils/whatsapp');
const router = express.Router();

// Google OAuth client (replace with your own Client ID in .env)
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  place: user.place || '',
  profilePicture: user.profilePicture || ''
});

const maskPhone = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  const raw = String(phone).trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

// ============================================================
// @route   POST /api/auth/signup
// @desc    Register a new user (manual signup with password)
// ============================================================
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered! Please login.' });
    }

    const user = await User.create({ name, email, phone, password });

    res.status(201).json({
      message: 'Account created successfully!',
      user: toPublicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// ============================================================
// @route   POST /api/auth/google-signup
// @desc    Sign up / login with Google account
// ============================================================
router.post('/google-signup', async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user from Google data
      user = await User.create({
        name,
        email,
        googleId,
        profilePicture: picture,
        phone: ''
      });
    }

    res.json({
      message: 'Google sign-in successful!',
      token: generateToken(user._id),
      user: toPublicUser(user)
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(401).json({ message: 'Google authentication failed: ' + error.message });
  }
});

// ============================================================
// @route   POST /api/auth/forgot-password
// @desc    Send password reset OTP to email
// ============================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    // Generate reset OTP (5 minute expiry)
    const otp = generateOTP();
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Send reset OTP via WhatsApp only when a phone number is available
    if (!user.phone || user.phone.trim() === '') {
      return res.status(400).json({ message: 'No WhatsApp number found for this account. Please update your profile phone number.' });
    }

    const resetMsg = `🔑 *Sriram Cab Service*\n\nYour password reset OTP is: *${otp}*\n\nValid for 5 minutes. Do not share this.`;
    const waResult = await sendWhatsApp(user.phone, resetMsg);
    if (!waResult.ok) {
      user.resetOtp = null;
      user.resetOtpExpiry = null;
      await user.save();
      return res.status(502).json({
        message: `Reset OTP could not be sent to WhatsApp ${maskPhone(user.phone)}. Please verify the number and Twilio sandbox join status, then try again.`
      });
    }

    console.log(`📲 Reset OTP sent via WhatsApp to ${user.phone}`);
    res.json({ message: `Reset OTP sent to WhatsApp ${maskPhone(user.phone)}` });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// ============================================================
// @route   POST /api/auth/reset-password
// @desc    Reset password using OTP
// ============================================================
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Verify reset OTP
    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(401).json({ message: 'Invalid reset code. Please try again.' });
    }

    if (new Date() > user.resetOtpExpiry) {
      user.resetOtp = null;
      user.resetOtpExpiry = null;
      await user.save();
      return res.status(401).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    // Update password and clear reset OTP
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully! You can now login.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// ============================================================
// @route   POST /api/auth/login
// @desc    Login user with email & password (legacy support)
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    res.json({
      message: 'Login successful!',
      token: generateToken(user._id),
      user: toPublicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// ============================================================
// @route   GET /api/auth/me
// @desc    Verify token and return current user data
// ============================================================
const { protect } = require('../middleware/auth');
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      user: toPublicUser(req.user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// ============================================================
// @route   PUT /api/auth/profile
// @desc    Update logged-in user profile details
// @access  Private
// ============================================================
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, place, profilePicture } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    req.user.name = name.trim();
    req.user.phone = phone.trim();
    req.user.place = (place || '').trim();
    req.user.profilePicture = (profilePicture || '').trim() || null;
    await req.user.save();

    res.json({ message: 'Profile updated successfully!', user: toPublicUser(req.user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;
