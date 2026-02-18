const express = require('express');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { pickup, dropoff, distance, fare, estimatedTime } = req.body;

    const booking = await Booking.create({
      user: req.user._id,
      pickup,
      dropoff,
      distance,
      fare,
      estimatedTime
    });

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

module.exports = router;
