import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
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

// Database setup
const dbPath = join(__dirname, 'gym_booking.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Create Slots table
        db.run(`CREATE TABLE IF NOT EXISTS slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            time TEXT NOT NULL,
            capacity INTEGER DEFAULT 10
        )`);

        // Create Bookings table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            slot_id INTEGER NOT NULL,
            FOREIGN KEY (slot_id) REFERENCES slots (id),
            UNIQUE(user_id, slot_id)
        )`);

        // Seed slots if empty
        db.get("SELECT COUNT(*) as count FROM slots", (err, row) => {
            if (row.count === 0) {
                const slots = [
                    { name: 'HIIT Blast', time: '06:00 AM - 07:00 AM' },
                    { name: 'Power Yoga', time: '07:00 AM - 08:00 AM' },
                    { name: 'Cardio Burn', time: '08:00 AM - 09:00 AM' },
                    { name: 'Strength Training', time: '09:00 AM - 10:00 AM' },
                    { name: 'Zumba Dance', time: '04:00 PM - 05:00 PM' },
                    { name: 'CrossFit Challenge', time: '05:00 PM - 06:00 PM' },
                    { name: 'Pilates Flow', time: '06:00 PM - 07:00 PM' },
                    { name: 'Evening Stretch', time: '07:00 PM - 08:00 PM' }
                ];
                const stmt = db.prepare("INSERT INTO slots (name, time) VALUES (?, ?)");
                slots.forEach(slot => stmt.run(slot.name, slot.time));
                stmt.finalize();
                console.log('Seeded initial slots with names');
            }
        });
    });
}

// Routes

// GET /api/slots -> fetch all slots with booking count
app.get('/api/slots', (req, res) => {
    const query = `
        SELECT s.*, COUNT(b.id) as booked_count 
        FROM slots s 
        LEFT JOIN bookings b ON s.id = b.slot_id 
        GROUP BY s.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /api/my-bookings/:user_id -> fetch detailed bookings for a specific user
app.get('/api/my-bookings/:user_id', (req, res) => {
    const { user_id } = req.params;
    const query = `
        SELECT s.*, b.id as booking_id
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        WHERE b.user_id = ?
    `;
    db.all(query, [user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// POST /api/book -> book a slot
app.post('/api/book', (req, res) => {
    const { user_id, slot_id } = req.body;

    if (!user_id || !slot_id) {
        return res.status(400).json({ error: 'User ID and Slot ID are required' });
    }

    // 1. Check if user already booked this slot
    db.get("SELECT id FROM bookings WHERE user_id = ? AND slot_id = ?", [user_id, slot_id], (err, row) => {
        if (row) {
            return res.status(400).json({ error: 'You have already booked this slot' });
        }

        // 2. Check capacity
        const capQuery = `
            SELECT s.capacity, COUNT(b.id) as booked_count 
            FROM slots s 
            LEFT JOIN bookings b ON s.id = b.slot_id 
            WHERE s.id = ? 
            GROUP BY s.id
        `;
        db.get(capQuery, [slot_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Slot not found' });

            if (row.booked_count >= row.capacity) {
                return res.status(400).json({ error: 'Slot is full' });
            }

            // 3. Book the slot
            db.run("INSERT INTO bookings (user_id, slot_id) VALUES (?, ?)", [user_id, slot_id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Booking successful', id: this.lastID });
            });
        });
    });
});

// DELETE /api/cancel -> cancel a booking
app.delete('/api/cancel', (req, res) => {
    const { user_id, slot_id } = req.body;

    if (!user_id || !slot_id) {
        return res.status(400).json({ error: 'User ID and Slot ID are required' });
    }

    db.run("DELETE FROM bookings WHERE user_id = ? AND slot_id = ?", [user_id, slot_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json({ message: 'Booking cancelled successfully' });
    });
});

// Fallback route for React SPA (Express 5 compatible catch-all)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
