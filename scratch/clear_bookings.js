import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'server', 'gym_booking.db');
const db = new sqlite3.Database(dbPath);

db.run('DELETE FROM bookings', (err) => {
    if (err) {
        console.error('Error clearing bookings:', err.message);
    } else {
        console.log('Successfully cleared all bookings.');
    }
    db.close();
});
