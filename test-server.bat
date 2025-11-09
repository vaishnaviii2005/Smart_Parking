@echo off
echo Testing Smart Parking Backend Server...
echo.

echo 1. Testing Health Endpoint:
curl http://localhost:3000/api/health
echo.
echo.

echo 2. Testing Booking Endpoint:
curl -X POST http://localhost:3000/api/book ^
  -H "Content-Type: application/json" ^
  -d "{\"slotId\":\"S001\",\"lotName\":\"Lot A\",\"lotId\":\"lot-1\",\"slotType\":\"car\",\"vehicleNumber\":\"TEST123\",\"hours\":1,\"rate\":3}"
echo.
echo.

echo Test complete!

