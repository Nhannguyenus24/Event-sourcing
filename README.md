# 🏦 Banking App với Event Sourcing & CQRS

## 🎯 Tổng quan

Đây là một hệ thống ngân hàng hoàn chỉnh được xây dựng theo mô hình **Event Sourcing + CQRS + DDD**, cung cấp đầy đủ các chức năng cốt lõi của một ứng dụng banking hiện đại.

## 🚀 Chức năng chính

- ✅ **Tạo tài khoản (Create Account)** - Mở tài khoản mới với số dư ban đầu
- ✅ **Nạp tiền (Deposit Money)** - Nạp tiền vào tài khoản
- ✅ **Rút tiền (Withdraw Money)** - Rút tiền từ tài khoản (có kiểm tra số dư)
- ✅ **Chuyển tiền giữa 2 tài khoản (Transfer Between Accounts)** - Chuyển tiền an toàn với saga pattern
- ✅ **Xem số dư (View Balance)** - Kiểm tra số dư tài khoản real-time
- ✅ **Xem lịch sử giao dịch (Transaction History)** - Tra cứu lịch sử với bộ lọc nâng cao
- ✅ **Rollback giao dịch (Transaction Rollback)** - Hoàn tác giao dịch khi phát hiện lỗi/gian lận
- ✅ **Audit log** - Ghi nhận đầy đủ mọi hoạt động không thể chối bỏ

## 🧱 Kiến trúc dịch vụ (Service-Oriented Architecture)

Hệ thống được thiết kế theo **Domain-Driven Design (DDD)** với **Event Sourcing** và **CQRS**, chia thành 4 microservices chính:

### 🔧 1. Account Command Service (Write Model) - Port 3001
**Trách nhiệm**: Xử lý tất cả các lệnh nghiệp vụ (business commands)

**Chức năng chính**:
- Nhận và xử lý các command:
  - `CreateAccountCommand` - Tạo tài khoản mới
  - `DepositMoneyCommand` - Nạp tiền vào tài khoản
  - `WithdrawMoneyCommand` - Rút tiền từ tài khoản
  - `TransferMoneyCommand` - Chuyển tiền giữa các tài khoản
  - `RollbackTransactionCommand` - Hoàn tác giao dịch
  - `BlockAccountCommand` - Khóa tài khoản

**Thành phần**:
- `AccountAggregate` - Domain logic và business rules
- `Command Handlers` - Xử lý và validate commands
- `Event Publisher` - Gửi events đến RabbitMQ
- **Real Event Publishing** đến RabbitMQ (không simulation)

**Business Logic**:
- Kiểm tra số dư trước khi rút tiền/chuyển tiền
- Áp dụng hạn mức giao dịch
- Validate tính hợp lệ của tài khoản
- Tạo ra các domain events

### 💾 2. Event Store Service - Port 3002
**Trách nhiệm**: Quản lý event store và tính toàn vẹn dữ liệu

**Chức năng chính**:
- **Event Persistence**: Ghi lại các events theo thứ tự thời gian
- **Event Retrieval**: Truy xuất events theo aggregateId
- **Event Replay**: Phát lại events từ version cụ thể
- **Snapshot Management**: Tạo và quản lý snapshots để tối ưu performance
- **Compensating Events**: Xử lý rollback với compensating events
- **Concurrency Control**: Kiểm soát phiên bản events (optimistic locking)

**API endpoints**:
- `GET /api/events/aggregate/{id}` - Lấy tất cả events của một aggregate
- `GET /api/events/search` - Tìm kiếm events với filters
- `POST /api/events/replay` - Replay events từ version cụ thể
- `POST /api/events/snapshots` - Tạo snapshot cho aggregate
- `POST /api/events/rollback` - Tạo compensating event

**Event Schema**:
```json
{
  "id": "uuid",
  "aggregateId": "account-uuid",
  "eventType": "MoneyDeposited",
  "eventData": {
    "amount": 500000,
    "currency": "VND",
    "transactionId": "TXN-123",
    "description": "Salary deposit"
  },
  "version": 5,
  "timestamp": "2025-07-27T10:30:00Z",
  "metadata": {
    "userId": "user-123",
    "source": "mobile-app"
  }
}
```

### 📊 3. Query/Read Service (Projection) - Port 3003
**Trách nhiệm**: Duy trì Read Models được cập nhật real-time từ events

**Read Models được tối ưu**:
- `account_balances` - Số dư tài khoản real-time
- `transaction_history` - Lịch sử giao dịch với indexes tối ưu
- `account_summaries` - Thống kê tổng hợp theo tài khoản
- `daily_transaction_stats` - Thống kê giao dịch theo ngày

**API endpoints**:
- `GET /api/query/accounts` - Danh sách tất cả tài khoản
- `GET /api/query/accounts/{id}/balance` - Số dư tài khoản
- `GET /api/query/transactions` - Lịch sử giao dịch với filters
- `GET /api/query/accounts/{id}/transactions/recent` - Giao dịch gần đây
- `POST /api/query/accounts/statement` - Sao kê theo khoảng thời gian
- `GET /api/query/analytics/daily-stats` - Thống kê giao dịch

**Tính năng nâng cao**:
- **Real-time Updates**: Nhận events từ RabbitMQ và cập nhật ngay lập tức
- **Advanced Filtering**: Lọc theo thời gian, loại giao dịch, số tiền
- **Pagination**: Hỗ trợ phân trang cho danh sách lớn
- **Materialized Views**: Sử dụng materialized views cho truy vấn nhanh

### 🔄 4. Transaction Processor Service - Port 3004
**Trách nhiệm**: Xử lý các giao dịch phức tạp và background processing

**Chức năng chính**:
- **Transfer Orchestration**: Quản lý logic chuyển tiền giữa 2 tài khoản
- **Saga Pattern**: Phối hợp Withdraw + Deposit thành 1 transaction
- **Failure Handling**: Tạo `TransactionFailed` và rollback khi có lỗi
- **Notification Processing**: Gửi thông báo sau giao dịch
- **Fraud Detection**: Phát hiện giao dịch bất thường

**Event Processing**:
- Xử lý `MoneyTransferred` events phức hợp
- Tạo compensating events khi cần rollback
- Quản lý state machine cho các giao dịch dài hạn

## 📦 Domain Events (Banking Domain)

Hệ thống phát sinh và xử lý các events sau:

| Event | Mô tả | Trigger | Data |
|-------|-------|---------|------|
| `AccountCreated` | Tạo tài khoản mới | CreateAccount command | accountId, ownerName, initialBalance |
| `MoneyDeposited` | Nạp tiền vào tài khoản | Deposit command | amount, transactionId, description |
| `MoneyWithdrawn` | Rút tiền khỏi tài khoản | Withdraw command | amount, transactionId, newBalance |
| `MoneyTransferred` | Chuyển tiền thành công | Transfer command | fromAccount, toAccount, amount, transactionId |
| `MoneyReceived` | Nhận tiền từ chuyển khoản | Transfer completion | fromAccount, amount, transactionId |
| `TransactionRolledBack` | Giao dịch đã được rollback | Rollback command | originalTransactionId, reason, compensatingAmount |
| `AccountBlocked` | Tài khoản bị khóa | Block command | reason, blockedAt |
| `TransactionFailed` | Giao dịch thất bại | System error | reason, failedTransactionId, errorCode |

## 🔐 Tính năng Event Sourcing cốt lõi

| Tính năng | Ý nghĩa trong Banking | Trạng thái |
|-----------|----------------------|-----------|
| ✅ **Rollback** | Nếu chuyển tiền xong mà nạp bên kia lỗi → rollback | Hoàn thành |
| ✅ **Replay** | Xây dựng lại số dư tài khoản từ lịch sử events | Hoàn thành |
| ✅ **Snapshot** | Tạo snapshot mỗi 100 events để tăng tốc khởi động | Hoàn thành |
| ✅ **Audit Trail** | Theo dõi mọi giao dịch, không được phép mất dấu | Hoàn thành |
| ✅ **Temporal Query** | Truy vấn trạng thái tài khoản ở thời điểm trong quá khứ | Hoàn thành |
| ✅ **Concurrency Control** | Optimistic locking với event versioning | Hoàn thành |
| ✅ **Compensating Events** | Xử lý rollback với events bù trừ | Hoàn thành |

## 🎮 API Documentation (Swagger)

Mỗi service đều có documentation đầy đủ với Swagger UI:

- **Account Command Service**: http://localhost:3001/api/docs
- **Event Store Service**: http://localhost:3002/api/docs  
- **Query/Read Service**: http://localhost:3003/api/docs

### Tính năng Swagger:
- **Interactive Testing**: Test API trực tiếp trên browser
- **JWT Authentication**: Hỗ trợ Bearer token authentication
- **Request/Response Examples**: Ví dụ chi tiết cho mỗi endpoint
- **Error Documentation**: Mô tả đầy đủ error responses
- **Parameter Validation**: Hiển thị validation rules và constraints

## 🏗️ Hạ tầng kỹ thuật

### Backend Stack
- **NestJS** - Framework TypeScript với dependency injection
- **PostgreSQL 15** - Event store và read models database
- **RabbitMQ 3-management** - Message broker cho real-time events
- **Docker Compose** - Container orchestration

### Event Flow Architecture
```
[Command] → [Aggregate] → [Events] → [Event Store] → [RabbitMQ] → [Projections] → [Read Models]
```

1. **Command được gửi** → Account Command Service
2. **Business Logic** → Thực hiện trong AccountAggregate  
3. **Events được tạo** → Domain events theo DDD pattern
4. **Events được lưu** → Persist vào PostgreSQL Event Store
5. **Events được publish** → Gửi đến RabbitMQ topics
6. **Projections được cập nhật** → Query Service nhận events và cập nhật read models
7. **Read Models sẵn sàng** → Phục vụ queries với performance cao

## 🚀 Hướng dẫn cài đặt nhanh

### Bước 1: Khởi động hệ thống
```bash
# Clone/navigate to project directory
cd "d:\Intellij Project\Event Sourcing"

# Build và start tất cả services
docker-compose up --build -d
```

### Bước 2: Kiểm tra các services
- **PostgreSQL**: `localhost:5432` (eventstore/eventstore)
- **RabbitMQ Management**: `http://localhost:15672` (rabbitmq/password)
- **Account Command Service**: `http://localhost:3001`
- **Event Store Service**: `http://localhost:3002`
- **Query Read Service**: `http://localhost:3003`
- **Transaction Processor**: `http://localhost:3004`

### Bước 3: Cài đặt dependencies (cho local development)
```bash
# Cho từng service
cd account-command-service && npm install
cd ../event-store-service && npm install  
cd ../query-read-service && npm install
cd ../transaction-processor-service && npm install
```

### Bước 4: Test API với Swagger
1. Mở http://localhost:3001/api/docs
2. Dùng endpoint `/api/auth/login` để lấy JWT token
3. Click "Authorize" và nhập Bearer token
4. Test các endpoints với "Try it out"

## 🎯 Scenarios sử dụng thực tế

### Scenario 1: Tạo tài khoản và nạp tiền
```bash
# 1. Đăng nhập để lấy token
POST http://localhost:3001/api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# 2. Tạo tài khoản mới
POST http://localhost:3001/api/commands/create-account
Authorization: Bearer <token>
{
  "accountId": "550e8400-e29b-41d4-a716-446655440003",
  "accountNumber": "ACC003",
  "ownerName": "Nguyễn Văn A",
  "initialBalance": 1000000
}

# 3. Nạp tiền lương
POST http://localhost:3001/api/commands/deposit
Authorization: Bearer <token>
{
  "accountId": "550e8400-e29b-41d4-a716-446655440003",
  "amount": 15000000,
  "description": "Lương tháng 7/2025"
}
```

### Scenario 2: Chuyển tiền và theo dõi
```bash
# 1. Chuyển tiền cho bạn bè
POST http://localhost:3001/api/commands/transfer
Authorization: Bearer <token>
{
  "fromAccountId": "550e8400-e29b-41d4-a716-446655440003",
  "toAccountId": "550e8400-e29b-41d4-a716-446655440001", 
  "amount": 500000,
  "description": "Trả nợ cà phê"
}

# 2. Kiểm tra số dư sau chuyển
GET http://localhost:3003/api/query/accounts/550e8400-e29b-41d4-a716-446655440003/balance

# 3. Xem lịch sử giao dịch
GET http://localhost:3003/api/query/transactions?accountId=550e8400-e29b-41d4-a716-446655440003&limit=10
```

### Scenario 3: Rollback giao dịch đáng nghi
```bash
# 1. Phát hiện giao dịch bất thường và rollback
POST http://localhost:3001/api/commands/rollback
Authorization: Bearer <token>
{
  "accountId": "550e8400-e29b-41d4-a716-446655440003",
  "originalTransactionId": "TXN-1722067800-abc123",
  "rollbackReason": "Phát hiện giao dịch lạ - đăng nhập từ IP khác quốc gia",
  "amount": 500000,
  "transactionType": "TRANSFER"
}

# 2. Khóa tài khoản tạm thời
POST http://localhost:3001/api/commands/block-account
Authorization: Bearer <token>
{
  "accountId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "Tài khoản tạm khóa để điều tra giao dịch bất thường"
}
```

## 📋 API Endpoints chính

### 🔐 Authentication
```bash
# Đăng nhập để lấy JWT token
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 💳 Banking Operations (Port 3001)

#### Tạo tài khoản mới
```bash
POST http://localhost:3001/api/commands/create-account
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "accountId": "550e8400-e29b-41d4-a716-446655440003",
  "accountNumber": "ACC003",
  "ownerName": "Trần Thị B",
  "initialBalance": 2000000
}
```

#### Nạp tiền
```bash
POST http://localhost:3001/api/commands/deposit
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "accountId": "550e8400-e29b-41d4-a716-446655440001",
  "amount": 5000000,
  "description": "Nạp tiền từ ATM"
}
```

#### Rút tiền
```bash
POST http://localhost:3001/api/commands/withdraw
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "accountId": "550e8400-e29b-41d4-a716-446655440001",
  "amount": 1000000,
  "description": "Rút tiền mặt"
}
```

#### Chuyển tiền
```bash
POST http://localhost:3001/api/commands/transfer
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "fromAccountId": "550e8400-e29b-41d4-a716-446655440001",
  "toAccountId": "550e8400-e29b-41d4-a716-446655440002",
  "amount": 3000000,
  "description": "Chuyển tiền học phí"
}
```

#### Kiểm tra số dư
```bash
GET http://localhost:3001/api/commands/account/550e8400-e29b-41d4-a716-446655440001/balance
Authorization: Bearer <jwt-token>
```

### 💾 Event Store Operations (Port 3002)

#### Lấy tất cả events của một tài khoản
```bash
GET http://localhost:3002/api/events/aggregate/550e8400-e29b-41d4-a716-446655440001
```

#### Tìm kiếm events với filters
```bash
GET http://localhost:3002/api/events/search?aggregateId=550e8400-e29b-41d4-a716-446655440001&eventType=MoneyDeposited&fromDate=2025-07-01
```

#### Replay events từ version cụ thể
```bash
POST http://localhost:3002/api/events/replay
Content-Type: application/json

{
  "aggregateId": "550e8400-e29b-41d4-a716-446655440001",
  "fromVersion": 5
}
```

#### Tạo snapshot để tối ưu
```bash
POST http://localhost:3002/api/events/snapshots
Content-Type: application/json

{
  "aggregateId": "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "balance": 15000000,
    "status": "ACTIVE",
    "lastTransactionAt": "2025-07-27T10:30:00Z"
  }
}
```

### 📊 Query/Read Operations (Port 3003)

#### Lấy số dư tài khoản (Read Model tối ưu)
```bash
GET http://localhost:3003/api/query/accounts/550e8400-e29b-41d4-a716-446655440001/balance
```

#### Xem lịch sử giao dịch với filters
```bash
GET http://localhost:3003/api/query/transactions?accountId=550e8400-e29b-41d4-a716-446655440001&page=1&limit=20&fromDate=2025-07-01&toDate=2025-07-31
```

#### Lấy sao kê tài khoản
```bash
POST http://localhost:3003/api/query/accounts/statement
Content-Type: application/json

{
  "accountId": "550e8400-e29b-41d4-a716-446655440001",
  "fromDate": "2025-07-01",
  "toDate": "2025-07-31"
}
```

#### Thống kê giao dịch theo ngày
```bash
GET http://localhost:3003/api/query/analytics/daily-stats?days=30
```

## 🔄 Event Flow & Message Processing

### Event Publishing Flow
1. **Command được thực hiện** → Validate và execute business logic  
2. **Domain Events được tạo** → Trong AccountAggregate
3. **Events được persist** → Lưu vào PostgreSQL Event Store
4. **Events được publish** → Gửi đến RabbitMQ với routing key
5. **Services consume events** → Query Service và Transaction Processor nhận events
6. **Read Models được cập nhật** → Real-time projection updates

### RabbitMQ Configuration
- **Exchange**: `event-sourcing-exchange` (topic)
- **Routing Keys**: 
  - `account.created`
  - `account.money.deposited`
  - `account.money.withdrawn` 
  - `account.money.transferred`
  - `account.transaction.rolledback`
  - `account.blocked`

### Sample Events được publish
```json
{
  "eventType": "MoneyDeposited",
  "aggregateId": "550e8400-e29b-41d4-a716-446655440001",
  "eventData": {
    "amount": 5000000,
    "currency": "VND",
    "transactionId": "TXN-1722067800-abc123",
    "description": "Nạp tiền lương tháng 7",
    "timestamp": "2025-07-27T10:30:00Z"
  },
  "metadata": {
    "userId": "admin",
    "source": "web-app",
    "correlationId": "CORR-1722067800-def456"
  },
  "version": 8
}
```

## 🗄️ Database Schema

### Events Table (Event Store)
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB,
  version INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stream_id, version)
);

CREATE INDEX idx_events_stream_id ON events(stream_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
```

### Read Model Tables (Query Service)
```sql
-- Bảng tài khoản (read model)
CREATE TABLE accounts (
  account_id UUID PRIMARY KEY,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- Bảng lịch sử giao dịch (read model)  
CREATE TABLE transactions (
  transaction_id VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
```

## 🛠️ Development & Testing

### Chạy ở Development Mode
```bash
# Terminal 1 - Infrastructure
docker-compose up postgres rabbitmq

# Terminal 2 - Account Command Service  
cd account-command-service
npm run start:dev

# Terminal 3 - Event Store Service
cd event-store-service  
npm run start:dev

# Terminal 4 - Query/Read Service
cd query-read-service
npm run start:dev
```

### Build cho Production
```bash
# Build tất cả services
npm run build

# Chạy production mode
npm run start:prod
```

### Testing với Swagger
1. Mở Swagger documentation của bất kỳ service nào
2. Sử dụng "Try it out" để test endpoints
3. Xem real-time event processing qua các services
4. Monitor RabbitMQ để theo dõi event flow

### Kiểm tra Event Processing
```bash
# Xem logs của một service
docker-compose logs -f account-command-service

# Kiểm tra RabbitMQ queues
curl -u rabbitmq:password http://localhost:15672/api/queues

# Kết nối PostgreSQL để xem events
docker exec -it event-sourcing-postgres psql -U eventstore -d eventstore
SELECT * FROM events ORDER BY created_at DESC LIMIT 10;
```

## 🏆 Lợi ích của Event Sourcing trong Banking

### 1. 🔍 Audit Trail hoàn chỉnh
- **Tuân thủ quy định**: Mọi giao dịch đều được ghi lại không thể thay đổi
- **Truy vết gian lận**: Có thể trace back mọi thay đổi số dư
- **Compliance**: Đáp ứng yêu cầu kiểm toán ngân hàng

### 2. ⏱️ Temporal Queries
- **Số dư tại thời điểm**: Xem số dư tài khoản ở bất kỳ thời điểm nào
- **Lịch sử chi tiết**: Tái tạo trạng thái từ events
- **Phân tích xu hướng**: Phân tích pattern giao dịch theo thời gian

### 3. 🔄 Rollback & Recovery
- **Rollback an toàn**: Sử dụng compensating events thay vì xóa dữ liệu
- **Disaster Recovery**: Rebuild toàn bộ state từ events
- **Point-in-time Recovery**: Khôi phục về trạng thái cụ thể

### 4. 📈 Scalability & Performance  
- **CQRS**: Tách biệt read/write cho performance tối ưu
- **Read Models**: Tối ưu cho từng loại query
- **Horizontal Scaling**: Scale read và write models độc lập

### 5. 🔗 Integration
- **Event-driven**: Dễ dàng tích hợp với external systems
- **Real-time**: Instant notifications và updates
- **Microservices**: Perfect fit cho kiến trúc microservices

## 🚨 Troubleshooting

### Kiểm tra Service Logs
```bash
# Xem logs của từng service
docker-compose logs account-command-service
docker-compose logs event-store-service
docker-compose logs query-read-service
docker-compose logs postgres
docker-compose logs rabbitmq
```

### Reset toàn bộ hệ thống
```bash
# Xóa tất cả containers và volumes
docker-compose down -v

# Rebuild và start lại
docker-compose up --build -d
```

### Test RabbitMQ Connection
- Truy cập RabbitMQ Management UI: `http://localhost:15672`
- Login: `rabbitmq/password`
- Kiểm tra:
  - **Exchanges**: `event-sourcing-exchange`
  - **Queues**: `account.events`, `transaction.events`, `query.events`
  - **Messages**: Xem messages flow real-time

### Kiểm tra Database
```bash
# Kết nối PostgreSQL
docker exec -it event-sourcing-postgres psql -U eventstore -d eventstore

# Xem events gần đây
SELECT event_type, created_at, event_data->>'amount' as amount 
FROM events 
ORDER BY created_at DESC LIMIT 20;

# Kiểm tra read models
SELECT account_number, owner_name, balance, status 
FROM accounts;
```

### Common Issues

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Port conflicts | Ports 3001-3004, 5432, 5672, 15672 đã được sử dụng | Kiểm tra và stop các services đang chạy |
| Database connection | PostgreSQL chưa ready | Đợi PostgreSQL start hoàn toàn |
| RabbitMQ connection | RabbitMQ service unhealthy | Restart RabbitMQ container |
| Missing dependencies | Chưa chạy `npm install` | Install dependencies trong mỗi service |
| JWT token expired | Token quá hạn | Login lại để lấy token mới |

## 📊 Sample Data (Pre-seeded)

Hệ thống có sẵn data mẫu để test:

### Tài khoản mẫu
- **ACC001**: `550e8400-e29b-41d4-a716-446655440001` 
  - Chủ tài khoản: Nguyễn Văn A
  - Số dư: 10,000,000 VND
- **ACC002**: `550e8400-e29b-41d4-a716-446655440002`
  - Chủ tài khoản: Trần Thị B  
  - Số dư: 25,000,000 VND

### User Login
- **Username**: `admin`
- **Password**: `admin123`

## 🔒 Security Features

- ✅ **JWT Authentication**: Bearer token cho API access
- ✅ **Input Validation**: Class-validator cho tất cả DTOs
- ✅ **SQL Injection Protection**: Parameterized queries
- ✅ **CORS Enabled**: Cross-origin resource sharing
- ✅ **Rate Limiting**: Có thể thêm cho production
- ✅ **Environment Variables**: Secure configuration management

## 🎯 Kết luận

Hệ thống Banking với Event Sourcing này cung cấp:

- ✅ **Kiến trúc hiện đại**: Event Sourcing + CQRS + DDD
- ✅ **Chức năng đầy đủ**: Tất cả operations của một ngân hàng  
- ✅ **Real-time Processing**: Events được xử lý ngay lập tức
- ✅ **Audit Trail**: Ghi nhận đầy đủ mọi thay đổi
- ✅ **Scalable**: Có thể scale từng component độc lập
- ✅ **Production Ready**: Docker orchestration với monitoring
- ✅ **Developer Friendly**: Swagger documentation đầy đủ

Đây là một foundation vững chắc cho việc xây dựng hệ thống ngân hàng core banking system thực tế! 🏦✨
