import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the React (Vite) build folder
app.use(express.static(path.join(__dirname, "../client/dist")));

// MongoDB Setup
const MONGODB_URI = "mongodb+srv://chevellapraneethreddy46_db_user:MkonkXnBlHLH2KKy@slotbooking.kmdghhv.mongodb.net/gym_booking?appName=slotbooking";

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeDatabase();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const slotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  time: { type: String, required: true },
  capacity: { type: Number, default: 10 }
});

const bookingSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  slot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true }
});

// Ensure unique booking per user per slot
bookingSchema.index({ user_id: 1, slot_id: 1 }, { unique: true });

const Slot = mongoose.model('Slot', slotSchema);
const Booking = mongoose.model('Booking', bookingSchema);

async function initializeDatabase() {
  try {
    const count = await Slot.countDocuments();
    if (count === 0) {
      const initialSlots = [
        { name: 'HIIT Blast', time: '06:00 AM - 07:00 AM' },
        { name: 'Power Yoga', time: '07:00 AM - 08:00 AM' },
        { name: 'Cardio Burn', time: '08:00 AM - 09:00 AM' },
        { name: 'Strength Training', time: '09:00 AM - 10:00 AM' },
        { name: 'Zumba Dance', time: '04:00 PM - 05:00 PM' },
        { name: 'CrossFit Challenge', time: '05:00 PM - 06:00 PM' },
        { name: 'Pilates Flow', time: '06:00 PM - 07:00 PM' },
        { name: 'Evening Stretch', time: '07:00 PM - 08:00 PM' }
      ];
      await Slot.insertMany(initialSlots);
      console.log('Seeded initial slots in MongoDB');
    }
  } catch (err) {
    console.error('Initial seeding error:', err);
  }
}

// Routes

// GET /api/slots -> fetch all slots with booking count
app.get('/api/slots', async (req, res) => {
  try {
    const slots = await Slot.find().lean();
    
    // Get booking counts for each slot
    const slotsWithCounts = await Promise.all(slots.map(async (slot) => {
      const booked_count = await Booking.countDocuments({ slot_id: slot._id });
      return {
        ...slot,
        id: slot._id.toString(), // Map _id to id for frontend compatibility
        booked_count
      };
    }));
    
    res.json(slotsWithCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-bookings/:user_id -> fetch detailed bookings for a specific user
app.get('/api/my-bookings/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const bookings = await Booking.find({ user_id }).populate('slot_id').lean();
    
    // Map to a format compatible with frontend
    const userBookings = bookings.map(b => ({
      ...b.slot_id,
      id: b.slot_id._id.toString(),
      booking_id: b._id.toString()
    }));
    
    res.json(userBookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/book -> book a slot
app.post('/api/book', async (req, res) => {
  try {
    const { user_id, slot_id } = req.body;

    if (!user_id || !slot_id) {
      return res.status(400).json({ error: 'User ID and Slot ID are required' });
    }

    // 1. Check if user already booked this slot
    const existing = await Booking.findOne({ user_id, slot_id });
    if (existing) {
      return res.status(400).json({ error: 'You have already booked this slot' });
    }

    // 2. Check capacity
    const slot = await Slot.findById(slot_id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    const bookedCount = await Booking.countDocuments({ slot_id });
    if (bookedCount >= slot.capacity) {
      return res.status(400).json({ error: 'Slot is full' });
    }

    // 3. Book the slot
    const newBooking = new Booking({ user_id, slot_id });
    await newBooking.save();
    
    res.json({ message: 'Booking successful', id: newBooking._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cancel -> cancel a booking
app.delete('/api/cancel', async (req, res) => {
  try {
    const { user_id, slot_id } = req.body;

    if (!user_id || !slot_id) {
      return res.status(400).json({ error: 'User ID and Slot ID are required' });
    }

    const result = await Booking.deleteOne({ user_id, slot_id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback route for React SPA
app.use((req, res) => {
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
