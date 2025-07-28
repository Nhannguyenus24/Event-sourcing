# Event Sourcing System Test Commands

## Build and Start Services
```bash
cd "d:\Intellij Project\Event Sourcing"
docker-compose up --build -d
```

## Check Service Status
```bash
docker-compose ps
docker-compose logs account-command-service
docker-compose logs event-store-service
docker-compose logs query-read-service
```

## Test Account Command Service
```bash
# Create a new account
curl -X POST http://localhost:3001/api/commands/create-account \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "550e8400-e29b-41d4-a716-446655440003",
    "accountNumber": "ACC003", 
    "ownerName": "Test User",
    "initialBalance": 1000
  }'

# Deposit money
curl -X POST http://localhost:3001/api/commands/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 500,
    "description": "Test deposit"
  }'

# Check balance
curl http://localhost:3001/api/commands/account/550e8400-e29b-41d4-a716-446655440001/balance
```

## Test Event Store Service
```bash
# Get events for account
curl http://localhost:3002/api/events/aggregate/550e8400-e29b-41d4-a716-446655440001

# Get aggregate state
curl http://localhost:3002/api/events/aggregate/550e8400-e29b-41d4-a716-446655440001/state

# Get event statistics
curl http://localhost:3002/api/events/statistics
```

## Test Query Read Service
```bash
# Get account balance (read model)
curl http://localhost:3003/api/query/accounts/550e8400-e29b-41d4-a716-446655440001/balance

# Get all accounts
curl http://localhost:3003/api/query/accounts

# Get transaction history
curl "http://localhost:3003/api/query/transactions?accountId=550e8400-e29b-41d4-a716-446655440001&page=1&limit=10"

# Get recent transactions
curl http://localhost:3003/api/query/accounts/550e8400-e29b-41d4-a716-446655440001/transactions/recent?limit=5
```

## Verify RabbitMQ
- Access management UI: http://localhost:15673 (rabbitmq/password)
- Check exchanges: `event-sourcing-exchange`
- Check queues: `account.events`, `query.events`, `transaction.events`

## Verify PostgreSQL
```bash
# Connect to database
docker exec -it event-sourcing-postgres psql -U postgres -d event_store

# Check tables
\dt

# Check events
SELECT event_type, COUNT(*) FROM events GROUP BY event_type;

# Check accounts
SELECT * FROM accounts;

# Check transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;
```

## Stop Services
```bash
docker-compose down -v  # This will also remove volumes (data)
# OR
docker-compose down     # Keep data
```
