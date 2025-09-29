# Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose
- Python 3.11+ (for analytics service)

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/sandeepramdas/Saas-EV-Power-Station-Management.git
cd Saas-EV-Power-Station-Management

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start infrastructure services
docker-compose up -d

# 5. Set up database
npm run db:migrate
npm run db:seed

# 6. Start all services
npm run dev
```

## Production Deployment

### Docker Production Build
```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment
```bash
# Apply namespace
kubectl apply -f kubernetes/namespace.yaml

# Deploy infrastructure
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/influxdb.yaml

# Deploy services
kubectl apply -f kubernetes/auth-service.yaml
kubectl apply -f kubernetes/station-service.yaml
kubectl apply -f kubernetes/payment-service.yaml
kubectl apply -f kubernetes/analytics-service.yaml

# Deploy ingress
kubectl apply -f kubernetes/ingress.yaml
```

## Service Architecture

### Microservices
- **auth-service** (port 3001) - Authentication & multi-tenancy
- **station-service** (port 3002) - Station management & monitoring
- **booking-service** (port 3003) - Reservations & scheduling
- **payment-service** (port 3004) - Payment processing
- **analytics-service** (port 8003) - AI analytics & insights
- **notification-service** (port 3005) - Real-time notifications

### Frontend Applications
- **admin-dashboard** (port 3000) - Station operator dashboard
- **customer-app** - React Native mobile app

### Databases
- **PostgreSQL** - Primary application data
- **Redis** - Caching & session storage
- **InfluxDB** - Time-series IoT data

## Monitoring & Observability

### Health Checks
```bash
# Check service health
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # Station service
curl http://localhost:3004/health  # Payment service
curl http://localhost:8003/health  # Analytics service
```

### Metrics Endpoints
- Prometheus metrics: `/metrics`
- Custom metrics: `/api/metrics`

### Logging
- Structured JSON logging
- Log aggregation with ELK stack
- Error tracking with Sentry

## Security Considerations

### Authentication
- JWT tokens with refresh mechanism
- Multi-tenant isolation
- Role-based access control
- API rate limiting

### Data Protection
- Encryption at rest and in transit
- PCI DSS compliance for payments
- GDPR compliance for user data
- Regular security audits

## Scaling Strategy

### Horizontal Scaling
- Stateless microservices
- Load balancer configuration
- Database read replicas
- Redis clustering

### Auto-scaling
- Kubernetes HPA based on CPU/memory
- Custom metrics scaling (API requests, queue length)
- Predictive scaling for demand patterns

## Backup & Recovery

### Database Backups
```bash
# PostgreSQL backup
pg_dump -h localhost -U admin ev_platform > backup.sql

# Redis backup
redis-cli --rdb backup.rdb

# InfluxDB backup
influx backup /path/to/backup
```

### Disaster Recovery
- Multi-region deployment
- Automated failover
- Regular backup testing
- RTO: 4 hours, RPO: 1 hour

## CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test
      - name: Build Docker images
        run: docker-compose build
      - name: Deploy to production
        run: kubectl apply -f kubernetes/
```

## Environment Configuration

### Development
- Hot reloading enabled
- Debug logging
- Mock external services
- Local database

### Staging
- Production-like environment
- Real external integrations
- Performance testing
- Security scanning

### Production
- High availability setup
- Monitoring & alerting
- Automated backups
- SSL termination