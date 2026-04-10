const express = require('express');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');
const router = express.Router();
const User = require('../models/User');
const sendWhatsApp = require('../utils/whatsapp');

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { pickup, dropoff, distance, fare, estimatedTime, carType, contactPhone } = req.body;

    // Fetch user details
    const user = await User.findById(req.user._id);
    const trimmedContact = (contactPhone || '').trim();
    if (user && (!user.phone || user.phone.trim() === '') && trimmedContact) {
      user.phone = trimmedContact;
      await user.save();
    }

    const booking = await Booking.create({
      user: req.user._id,
      pickup,
      dropoff,
      distance,
      fare,
      estimatedTime,
      carType: carType || '',
      contactPhone: trimmedContact || (user && user.phone ? user.phone : '')
    });

    // Notify owner on WhatsApp with full booking details
    const ownerNumber = '+917358498414';
    const effectivePhone = (user && user.phone ? user.phone : trimmedContact) || 'Not provided';
    const ownerMessage =
      `🚗 *New Booking Alert - Sriram Cab Service*\n\n` +
      `👤 *Customer:* ${user ? user.name : 'Unknown'}\n` +
      `📧 *Email:* ${user ? user.email : 'N/A'}\n` +
      `📞 *Phone:* ${effectivePhone}\n\n` +
      `� *Car Type:* ${carType || 'Not specified'}\n` +
      `�📍 *Pickup:* ${pickup}\n` +
      `🏁 *Drop:* ${dropoff}\n` +
      `📏 *Distance:* ${distance} km\n` +
      `⏱️ *Est. Time:* ${estimatedTime} min\n` +
      `💰 *Fare:* ₹${fare}\n\n` +
      `🕐 *Booked At:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
    console.log('📲 Sending booking notification to owner...');
    await sendWhatsApp(ownerNumber, ownerMessage);

    // Also notify the customer if they have a phone number
    if (user && user.phone) {
      const customerMessage =
        `✅ *Booking Confirmed - Sriram Cab Service*\n\n` +
        `Hi ${user.name}! Your ride is booked.\n` +
        `📍 From: ${pickup}\n` +
        `🏁 To: ${dropoff}\n` +
        `📏 Distance: ${distance} km\n` +
        `💰 Fare: ₹${fare}\n\n` +
        `For any queries, call: +91 73584 98414`;
      await sendWhatsApp(user.phone, customerMessage);
    }

    res.status(201).json({
      message: 'Ride booked successfully!',
      booking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// @route   GET /api/bookings
// @desc    Get all bookings for logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// @route   GET /api/bookings/test-whatsapp
// @desc    Test WhatsApp notification to owner
// @access  Private
router.get('/test-whatsapp', protect, async (req, res) => {
  try {
    await sendWhatsApp('+917358498414', '🧪 Test message from Sriram Cab Service backend! WhatsApp is working ✅');
    res.json({ message: 'Test WhatsApp sent! Check your terminal for logs.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
