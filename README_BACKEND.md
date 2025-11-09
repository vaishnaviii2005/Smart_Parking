# Smart Parking - Backend API

This backend server handles parking slot bookings and provides directions to parking locations.

## Features

- ✅ Book parking slots via API
- ✅ Generate step-by-step directions to parking spots
- ✅ Track bookings with unique IDs
- ✅ Get booking details and directions
- ✅ Release/cancel bookings

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Server runs on:** `http://localhost:3000`

## API Endpoints

### `POST /api/book`
Book a parking slot and get directions.

**Request Body:**
```json
{
  "slotId": "S001",
  "lotName": "Lot A",
  "lotId": "lot-1",
  "slotType": "car",
  "vehicleNumber": "MH 12 AB 3456",
  "hours": 2,
  "rate": 3
}
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "bookingId": "BK-1234567890-abc123",
    "slotId": "S001",
    "lotName": "Lot A",
    "vehicleNumber": "MH 12 AB 3456",
    "hours": 2,
    "totalCost": 6,
    "status": "confirmed",
    "bookingTime": "2024-01-01T12:00:00.000Z",
    "expiryTime": "2024-01-01T14:00:00.000Z"
  },
  "directions": {
    "slotId": "S001",
    "lotName": "Lot A",
    "address": "123 Main Street, Downtown",
    "entrance": "North Entrance",
    "zone": "Zone A",
    "directions": [
      {
        "step": 1,
        "instruction": "Navigate to 123 Main Street, Downtown",
        "details": "Your destination is 123 Main Street, Downtown"
      },
      ...
    ],
    "googleMapsLink": "https://www.google.com/maps/search/?api=1&query=..."
  }
}
```

### `GET /api/booking/:bookingId`
Get booking details and directions by booking ID.

### `GET /api/bookings`
Get all bookings (for admin/testing).

### `POST /api/release`
Release/cancel a booking.

**Request Body:**
```json
{
  "slotId": "S001"
}
```
or
```json
{
  "bookingId": "BK-1234567890-abc123"
}
```

### `GET /api/health`
Health check endpoint.

## Frontend Integration

The frontend (`assets/app.js`) is configured to call the backend API when a user clicks the "Book" button. When booking is confirmed, a directions dialog automatically displays with:

- Booking confirmation details
- Step-by-step directions
- Google Maps link
- Parking zone information

## Configuration

The frontend API URL can be changed in `assets/app.js`:
```javascript
const API_BASE_URL = "http://localhost:3000/api";
```

## Notes

- Bookings are stored in-memory (not persistent). For production, use a database.
- Directions are generated based on parking lot names and slot IDs.
- The server serves static files from the project root, so the frontend can be accessed at `http://localhost:3000`

