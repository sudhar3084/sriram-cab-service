const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pickup: {
    type: String,
    required: [true, 'Pickup location is required'],
    trim: true
  },
  dropoff: {
    type: String,
    required: [true, 'Dropoff location is required'],
    trim: true
  },
  distance: {
    type: Number,
    required: true
  },
  fare: {
    type: Number,
    required: true
  },
  estimatedTime: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'in-progress', 'completed', 'cancelled'],
    default: 'booked'
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
