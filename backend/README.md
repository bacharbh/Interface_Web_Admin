# Smart Shepherd Backend API

Backend server for the Smart Shepherd Admin Dashboard - an IoT-based sheep monitoring and management system.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Sheep Management**: CRUD operations for sheep records with health tracking
- **Real-time Telemetry**: MQTT integration for IoT device data
- **Geofencing**: Virtual boundary monitoring with violation alerts
- **Notifications**: Real-time alerts and system notifications
- **WebSocket Support**: Live updates via Socket.IO
- **Security**: Rate limiting, CORS, helmet protection

## Tech Stack

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **MQTT** for IoT communication
- **Socket.IO** for real-time updates
- **JWT** for authentication
- **Winston** for logging

## Prerequisites

- Node.js 18+ 
- MongoDB 5.0+
- MQTT Broker (Mosquitto recommended)

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   ```bash
   # On Windows
   net start MongoDB
   
   # On macOS/Linux
   sudo systemctl start mongod
   ```

4. **Start MQTT Broker**
   ```bash
   # Install Mosquitto
   # On Windows: Download from https://mosquitto.org/download/
   # On macOS: brew install mosquitto
   # On Linux: sudo apt-get install mosquitto
   
   # Start the broker
   mosquitto -c mosquitto.conf
   ```

5. **Start the server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Variables

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/smart-shepherd

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Logging
LOG_LEVEL=info
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Sheep Management
- `GET /api/sheep` - Get all sheep (with pagination)
- `GET /api/sheep/:id` - Get specific sheep
- `POST /api/sheep` - Register new sheep
- `PUT /api/sheep/:id` - Update sheep information
- `PATCH /api/sheep/:id/location` - Update sheep location
- `POST /api/sheep/:id/medical` - Add medical record
- `DELETE /api/sheep/:id` - Delete sheep (soft delete)

### Telemetry
- `POST /api/telemetry` - Receive telemetry data from IoT devices
- `GET /api/telemetry/latest` - Get latest telemetry for all sheep
- `GET /api/telemetry/:sheepId/history` - Get telemetry history
- `GET /api/telemetry/stats` - Get telemetry statistics

### Geofencing
- `GET /api/geofence` - Get all geofences
- `GET /api/geofence/:id` - Get specific geofence
- `POST /api/geofence` - Create new geofence
- `PUT /api/geofence/:id` - Update geofence
- `DELETE /api/geofence/:id` - Delete geofence
- `POST /api/geofence/check` - Check sheep location against geofences
- `GET /api/geofence/violations` - Get geofence violations

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/:id` - Get specific notification
- `POST /api/notifications` - Create notification
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/mark-read` - Mark multiple as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications/clear` - Clear all read notifications
- `GET /api/notifications/stats` - Get notification statistics

### System
- `GET /api/health` - Health check endpoint

## WebSocket Events

### Client can listen to:
- `sheep:added` - New sheep registered
- `sheep:updated` - Sheep information updated
- `sheep:location` - Sheep location updated
- `sheep:medical` - Medical record added
- `sheep:deleted` - Sheep deleted
- `telemetry:realtime` - Real-time telemetry data
- `geofence:violation` - Geofence violation detected
- `notification:new` - New notification
- `alerts:new` - New system alerts

### MQTT Integration:
- `mqtt:telemetry` - Telemetry data from devices
- `mqtt:location` - Location updates
- `mqtt:alerts` - Device alerts
- `mqtt:device-status` - Device status updates
- `mqtt:heartbeat` - Device heartbeats

## MQTT Topics

### Subscribe Topics (Server):
- `shepherd/+/telemetry` - Device telemetry data
- `shepherd/+/location` - Location updates
- `shepherd/+/alerts` - Alert notifications
- `shepherd/+/status` - Device status
- `shepherd/+/heartbeat` - Device heartbeat

### Publish Topics (Server):
- `shepherd/+/commands/+` - Commands to devices
- `shepherd/system/+` - System-wide messages

## User Roles

- **Admin**: Full access to all features
- **Operator**: Can manage sheep, geofences, view telemetry
- **Viewer**: Read-only access to dashboard data

## Security Features

- JWT token authentication
- Rate limiting (100 requests per 15 minutes per IP)
- CORS protection
- Helmet security headers
- Input validation with Joi
- Password hashing with bcryptjs

## Logging

Logs are written to:
- `error.log` - Error messages
- `combined.log` - All log messages
- Console output (development mode)

## Development

### Running tests
```bash
npm test
```

### Development with auto-restart
```bash
npm run dev
```

## Deployment

### Production setup
1. Set `NODE_ENV=production`
2. Use a production MongoDB instance
3. Configure secure JWT secrets
4. Set up proper MQTT broker security
5. Configure reverse proxy (nginx/Apache)
6. Set up SSL certificates

### Docker deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **MongoDB connection failed**
   - Ensure MongoDB is running
   - Check connection string in .env
   - Verify network connectivity

2. **MQTT connection failed**
   - Verify MQTT broker is running
   - Check broker URL and credentials
   - Ensure firewall allows MQTT port (1883)

3. **Authentication errors**
   - Verify JWT secret is set
   - Check token expiration
   - Ensure proper token format

4. **CORS errors**
   - Verify FRONTEND_URL in .env
   - Check browser console for specific errors

## License

MIT License - see LICENSE file for details
