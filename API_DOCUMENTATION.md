# API Documentation

## Authentication Service (Port 3001)

### Base URL: `http://localhost:3001`

### Authentication Endpoints

#### POST `/trpc/auth.login`
Login user and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "tenantDomain": "optional-domain"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TENANT_ADMIN",
    "tenant": {
      "id": "tenant_id",
      "name": "Station Operator Inc",
      "type": "STATION_OPERATOR"
    }
  }
}
```

#### POST `/trpc/auth.register`
Register new tenant and admin user.

**Request:**
```json
{
  "email": "admin@company.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "My EV Company",
  "tenantType": "STATION_OPERATOR"
}
```

#### GET `/trpc/auth.me`
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_token_here
```

---

## Station Service (Port 3002)

### Base URL: `http://localhost:3002`

### Station Management

#### POST `/trpc/station.create`
Create new charging station.

**Request:**
```json
{
  "name": "Downtown Station Alpha",
  "address": "123 Main St, Downtown",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "totalPorts": 8,
  "amenities": ["wifi", "restaurant", "parking"],
  "pricing": {
    "baseRate": 0.25,
    "peakMultiplier": 1.5,
    "peakHours": [17, 18, 19, 20]
  }
}
```

#### GET `/trpc/station.list`
Get stations for current tenant.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term

#### GET `/trpc/station.getById`
Get station details by ID.

**Request:**
```json
{
  "id": "station_id"
}
```

#### GET `/trpc/station.findNearby`
Find nearby stations.

**Request:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radius": 10,
  "connectorType": "CCS2",
  "availableOnly": true
}
```

### Charging Port Management

#### POST `/trpc/station.addPort`
Add charging port to station.

**Request:**
```json
{
  "stationId": "station_id",
  "portNumber": 3,
  "connectorType": "CCS2",
  "powerOutput": 150
}
```

#### PUT `/trpc/station.updatePortStatus`
Update charging port status.

**Request:**
```json
{
  "portId": "port_id",
  "status": "AVAILABLE"
}
```

### Real-time Monitoring

#### GET `/trpc/station.getRealtimeStats`
Get real-time station statistics.

**Request:**
```json
{
  "stationId": "station_id"
}
```

**Response:**
```json
{
  "totalPorts": 8,
  "availablePorts": 3,
  "occupiedPorts": 4,
  "outOfOrderPorts": 1,
  "activeSessions": 4,
  "totalRevenue": 234.50,
  "totalEnergy": 145.2,
  "utilizationRate": 0.625
}
```

---

## Payment Service (Port 3004)

### Base URL: `http://localhost:3004`

### Payment Processing

#### POST `/trpc/payment.createPaymentIntent`
Create payment intent for charging session.

**Request:**
```json
{
  "amount": 25.00,
  "currency": "USD",
  "sessionId": "session_id",
  "metadata": {
    "stationName": "Downtown Station"
  }
}
```

**Response:**
```json
{
  "paymentId": "payment_id",
  "clientSecret": "pi_client_secret",
  "amount": 25.00,
  "currency": "USD"
}
```

#### POST `/trpc/payment.confirmPayment`
Confirm successful payment.

**Request:**
```json
{
  "paymentIntentId": "pi_xxx",
  "paymentMethodId": "pm_xxx"
}
```

#### GET `/trpc/payment.getPaymentHistory`
Get user's payment history.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page

#### POST `/trpc/payment.refundPayment`
Process payment refund.

**Request:**
```json
{
  "paymentId": "payment_id",
  "amount": 25.00,
  "reason": "requested_by_customer"
}
```

### Subscription Management

#### POST `/trpc/payment.createSubscription`
Create subscription for tenant.

**Request:**
```json
{
  "priceId": "price_xxx",
  "paymentMethodId": "pm_xxx"
}
```

### Revenue Analytics

#### GET `/trpc/payment.getRevenueAnalytics`
Get revenue analytics for tenant.

**Request:**
```json
{
  "startDate": "2023-01-01T00:00:00Z",
  "endDate": "2023-12-31T23:59:59Z",
  "groupBy": "month"
}
```

---

## Analytics Service (Port 8003)

### Base URL: `http://localhost:8003`

### AI Predictions

#### POST `/predict/demand`
Predict charging demand for station.

**Request:**
```json
{
  "station_id": "station_id",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-07T23:59:59Z",
  "features": {
    "weather_condition": "sunny",
    "temperature": 22
  }
}
```

**Response:**
```json
{
  "station_id": "station_id",
  "predictions": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "predicted_demand": 12.5,
      "lower_bound": 10.2,
      "upper_bound": 14.8
    }
  ],
  "confidence_interval": [0.8, 0.95],
  "model_accuracy": {
    "mae": 2.1,
    "rmse": 3.2,
    "r2_score": 0.85
  }
}
```

#### POST `/optimize/pricing`
Optimize pricing based on demand.

**Request:**
```json
{
  "station_id": "station_id",
  "current_demand": 75.5,
  "competitor_prices": [0.28, 0.32, 0.25],
  "time_of_day": 18,
  "day_of_week": 1
}
```

#### POST `/predict/maintenance`
Predict maintenance needs for charging port.

**Request:**
```json
{
  "station_id": "station_id",
  "port_id": "port_id",
  "telemetry_data": {
    "voltage": 400.2,
    "current": 125.5,
    "temperature": 45.2,
    "vibration": 0.02
  }
}
```

### Insights Generation

#### GET `/analytics/insights/{tenant_id}`
Get AI-generated insights for tenant.

**Response:**
```json
{
  "tenant_id": "tenant_id",
  "insights": [
    {
      "type": "demand_pattern",
      "title": "Peak Usage Hours",
      "description": "Your stations see highest demand between 6-8 PM",
      "recommendation": "Consider dynamic pricing during peak hours",
      "impact": "Potential 15% revenue increase",
      "confidence": 0.87
    }
  ],
  "generated_at": "2024-01-01T12:00:00Z"
}
```

---

## WebSocket Real-time Events

### Connection: `ws://localhost:3002/ws`

### Event Types

#### Station Status Updates
```json
{
  "type": "station_status",
  "stationId": "station_id",
  "status": "online",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Port Status Updates
```json
{
  "type": "port_status",
  "portId": "port_id",
  "status": "OCCUPIED",
  "sessionId": "session_id",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Charging Session Updates
```json
{
  "type": "session_update",
  "sessionId": "session_id",
  "status": "ACTIVE",
  "energyUsed": 15.2,
  "chargingRate": 22.5,
  "estimatedCompletion": "2024-01-01T14:30:00Z"
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token",
    "details": "Token has expired"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

---

## Rate Limiting

### Limits by User Type
- **Free users**: 100 requests/minute
- **Premium users**: 1000 requests/minute
- **Enterprise**: 10000 requests/minute

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```