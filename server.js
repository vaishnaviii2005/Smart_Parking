const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// SQLite database setup
const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS lots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      lotId TEXT NOT NULL,
      lotName TEXT NOT NULL,
      type TEXT NOT NULL,
      rate REAL NOT NULL,
      status TEXT NOT NULL,
      vehicle TEXT DEFAULT ''
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      bookingId TEXT PRIMARY KEY,
      slotId TEXT NOT NULL,
      lotId TEXT,
      lotName TEXT,
      slotType TEXT,
      vehicleNumber TEXT,
      hours INTEGER,
      rate REAL,
      totalCost REAL,
      status TEXT,
      bookingTime TEXT,
      expiryTime TEXT,
      releasedAt TEXT
    )`);

    // Seed data if empty
    db.get('SELECT COUNT(*) as c FROM slots', (err, row) => {
      if (err) { console.error('DB count error:', err); return; }
      if (row && row.c === 0) {
        console.log('🌱 Seeding database with sample lots and slots...');
        const lotNames = ['Lot A', 'Lot B', 'Lot C', 'Rooftop', 'Basement 1'];
        const lots = lotNames.map((name, i) => ({ id: `lot-${i + 1}`, name }));
        const types = ['car', 'bike', 'ev', 'accessible'];
        const rateByType = { car: 3, bike: 1.5, ev: 4, accessible: 2.5 };

        const insertLot = db.prepare('INSERT INTO lots(id,name) VALUES(?,?)');
        lots.forEach(l => insertLot.run(l.id, l.name));
        insertLot.finalize();

        let idCounter = 1;
        const insertSlot = db.prepare('INSERT INTO slots(id,lotId,lotName,type,rate,status,vehicle) VALUES(?,?,?,?,?,?,?)');
        lots.forEach((lot) => {
          const count = 24; // deterministic sample size
          for (let i = 0; i < count; i++) {
            const type = types[(i + idCounter) % types.length];
            const rate = rateByType[type];
            const status = 'available';
            insertSlot.run(`S${String(idCounter).padStart(3, '0')}`, lot.id, lot.name, type, rate, status, '');
            idCounter++;
          }
        });
        insertSlot.finalize();
        console.log('✅ Seed complete');
      }
    });
  });
}

initDb();

// Generate directions based on parking lot and slot
function generateDirections(slotId, lotName, slotType) {
  // Map lot names to approximate locations/coordinates
  const lotLocations = {
    'Lot A': {
      address: '123 Main Street, Downtown',
      entrance: 'North Entrance',
      landmarks: ['next to City Hall', 'opposite Metro Station']
    },
    'Lot B': {
      address: '456 Park Avenue, Midtown',
      entrance: 'East Entrance',
      landmarks: ['near Shopping Mall', 'beside Park Plaza']
    },
    'Lot C': {
      address: '789 Commerce Road, Business District',
      entrance: 'South Entrance',
      landmarks: ['across from Office Tower', 'adjacent to Convention Center']
    },
    'Rooftop': {
      address: '321 Building Heights, City Center',
      entrance: 'Elevator Access - Level 5',
      landmarks: ['Top floor of Central Plaza', 'via Express Elevator']
    },
    'Basement 1': {
      address: '654 Underground Way, Sublevel District',
      entrance: 'Underground Access - Level B1',
      landmarks: ['Below Ground Floor', 'via Escalator or Elevator']
    }
  };

  const location = lotLocations[lotName] || {
    address: `${lotName} Parking Area`,
    entrance: 'Main Entrance',
    landmarks: ['Follow parking signs']
  };

  // Extract row/column from slot ID for more specific directions
  const slotNumber = slotId.replace('S', '');
  const slotNum = parseInt(slotNumber, 10);
  
  // Determine parking zone based on slot number
  let zone = '';
  let specificLocation = '';
  if (slotNum <= 30) {
    zone = 'Zone A';
    specificLocation = 'First two rows near entrance';
  } else if (slotNum <= 60) {
    zone = 'Zone B';
    specificLocation = 'Middle section';
  } else if (slotNum <= 90) {
    zone = 'Zone C';
    specificLocation = 'Back section';
  } else {
    zone = 'Zone D';
    specificLocation = 'Far end section';
  }

  // Generate step-by-step directions
  const directions = [
    {
      step: 1,
      instruction: `Navigate to ${location.address}`,
      details: `Your destination is ${location.address}`
    },
    {
      step: 2,
      instruction: `Enter through ${location.entrance}`,
      details: `Look for signs indicating "${location.entrance}"`
    },
    {
      step: 3,
      instruction: `Find ${zone} (${specificLocation})`,
      details: `Follow the overhead signs to ${zone}. Your slot ${slotId} is located in ${specificLocation}`
    },
    {
      step: 4,
      instruction: `Locate Slot ${slotId}`,
      details: `Slot ${slotId} is marked with clear signage. It's a ${slotType.toUpperCase()} parking space.`
    },
    {
      step: 5,
      instruction: 'Park your vehicle',
      details: `Confirm you're in Slot ${slotId} before exiting your vehicle. The slot is reserved for your booking.`
    }
  ];

  // Add landmarks if available
  if (location.landmarks.length > 0) {
    directions[0].landmarks = location.landmarks;
  }

  return {
    slotId,
    lotName,
    slotType,
    address: location.address,
    entrance: location.entrance,
    zone,
    directions,
    landmarks: location.landmarks,
    estimatedTime: '2-3 minutes',
    googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`
  };
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Parking API is running' });
});

// Book a parking slot
app.post('/api/book', async (req, res) => {
  try {
    const { slotId, lotName, lotId, slotType, vehicleNumber, hours, rate } = req.body;

    // Validate input
    if (!slotId || !lotName || !vehicleNumber || !hours) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slotId, lotName, vehicleNumber, hours'
      });
    }

    // Check slot availability in DB
    db.get('SELECT status, rate, lotId, lotName, type FROM slots WHERE id = ?', [slotId], (err, slotRow) => {
      if (err) {
        console.error('DB read slot error:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      if (!slotRow) {
        return res.status(404).json({ success: false, error: `Slot ${slotId} not found` });
      }
      if (slotRow.status !== 'available') {
        return res.status(409).json({ success: false, error: `Slot ${slotId} is already booked` });
      }

      // Calculate total cost
      const effRate = rate ?? slotRow.rate;
      const totalCost = effRate * hours;
      const bookingId = `BK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const bookingTime = new Date();
      const expiryTime = new Date(bookingTime.getTime() + hours * 60 * 60 * 1000);

      const insert = db.prepare(`INSERT INTO bookings(
        bookingId, slotId, lotId, lotName, slotType, vehicleNumber, hours, rate, totalCost, status, bookingTime, expiryTime
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
      insert.run(
        bookingId,
        slotId,
        lotId || slotRow.lotId,
        lotName || slotRow.lotName,
        slotType || slotRow.type,
        vehicleNumber,
        hours,
        effRate,
        totalCost,
        'confirmed',
        bookingTime.toISOString(),
        expiryTime.toISOString(),
        (insErr) => {
          if (insErr) {
            console.error('Insert booking error:', insErr);
            return res.status(500).json({ success: false, error: 'Failed to create booking' });
          }
          // Update slot status
          db.run('UPDATE slots SET status = ?, vehicle = ? WHERE id = ?', ['occupied', vehicleNumber, slotId], (updErr) => {
            if (updErr) {
              console.error('Update slot error:', updErr);
              return res.status(500).json({ success: false, error: 'Failed to update slot' });
            }
            const booking = {
              bookingId,
              slotId,
              lotId: lotId || slotRow.lotId,
              lotName: lotName || slotRow.lotName,
              slotType: slotType || slotRow.type,
              vehicleNumber,
              hours,
              rate: effRate,
              totalCost,
              status: 'confirmed',
              bookingTime: bookingTime.toISOString(),
              expiryTime: expiryTime.toISOString()
            };
            const directions = generateDirections(slotId, booking.lotName, booking.slotType);
            return res.json({ success: true, booking, directions, message: `Booking confirmed! Slot ${slotId} is reserved for ${hours} hour(s).` });
          });
        }
      );
    });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

// Get booking details with directions
app.get('/api/booking/:bookingId', (req, res) => {
  try {
    const { bookingId } = req.params;
    db.get('SELECT * FROM bookings WHERE bookingId = ?', [bookingId], (err, booking) => {
      if (err) {
        console.error('DB get booking error:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      const directions = generateDirections(booking.slotId, booking.lotName, booking.slotType);
      res.json({ success: true, booking, directions });
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all bookings (for admin/testing)
app.get('/api/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY bookingTime DESC', (err, rows) => {
    if (err) {
      console.error('DB list bookings error:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    res.json({ success: true, bookings: rows, count: rows.length });
  });
});

// Release/cancel a booking
app.post('/api/release', (req, res) => {
  try {
    const { slotId, bookingId } = req.body;

    if (!slotId && !bookingId) {
      return res.status(400).json({ success: false, error: 'Either slotId or bookingId is required' });
    }

    // Find booking
    const where = slotId ? ['slotId = ?', slotId] : ['bookingId = ?', bookingId];
    db.get(`SELECT * FROM bookings WHERE ${where[0]} ORDER BY bookingTime DESC`, [where[1]], (err, booking) => {
      if (err) {
        console.error('DB find booking error:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      db.run('UPDATE bookings SET status = ?, releasedAt = ? WHERE bookingId = ?', ['released', new Date().toISOString(), booking.bookingId], (uErr) => {
        if (uErr) {
          console.error('DB update booking error:', uErr);
          return res.status(500).json({ success: false, error: 'Failed to update booking' });
        }
        db.run('UPDATE slots SET status = ?, vehicle = ? WHERE id = ?', ['available', '', booking.slotId], (sErr) => {
          if (sErr) {
            console.error('DB update slot error:', sErr);
            return res.status(500).json({ success: false, error: 'Failed to release slot' });
          }
          return res.json({ success: true, message: `Slot ${booking.slotId} has been released`, booking: { ...booking, status: 'released' } });
        });
      });
    });
  } catch (error) {
    console.error('Release error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Lots and slots endpoints
app.get('/api/lots', (req, res) => {
  db.all('SELECT * FROM lots', (err, rows) => {
    if (err) { console.error('DB lots error:', err); return res.status(500).json({ success:false, error:'Database error' }); }
    res.json({ success: true, lots: rows });
  });
});

app.get('/api/slots', (req, res) => {
  db.all('SELECT * FROM slots', (err, rows) => {
    if (err) { console.error('DB slots error:', err); return res.status(500).json({ success:false, error:'Database error' }); }
    res.json({ success: true, slots: rows });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Smart Parking Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`✅ Server is ready to accept connections`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop other services using this port.`);
  } else {
    console.error(`❌ Server error:`, err);
  }
  process.exit(1);
});

