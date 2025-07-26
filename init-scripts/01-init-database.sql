-- Initialize database schema for event sourcing

-- Events table for storing all events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, version)
);

CREATE INDEX IF NOT EXISTS idx_events_stream_id ON events(stream_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_stream_version ON events(stream_id, version);

-- Snapshots table for aggregate snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_stream_id ON snapshots(stream_id);

-- Accounts read model table (optimized for queries)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_name ON accounts(owner_name);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- Transactions read model table (optimized for history queries)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    from_account_id UUID,
    to_account_id UUID,
    transaction_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Optimized indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_type ON transactions(account_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions(created_at DESC, transaction_type);

-- Account balances materialized view for faster balance queries
CREATE MATERIALIZED VIEW IF NOT EXISTS account_balances_summary AS
SELECT 
    a.id,
    a.account_number,
    a.owner_name,
    a.balance,
    a.status,
    a.created_at,
    a.updated_at,
    COUNT(t.id) as total_transactions,
    COALESCE(SUM(CASE WHEN t.transaction_type IN ('DEPOSIT', 'TRANSFER_IN') THEN t.amount ELSE 0 END), 0) as total_credits,
    COALESCE(SUM(CASE WHEN t.transaction_type IN ('WITHDRAWAL', 'TRANSFER_OUT') THEN t.amount ELSE 0 END), 0) as total_debits,
    MAX(t.created_at) as last_transaction_date
FROM accounts a
LEFT JOIN transactions t ON a.id = t.account_id
GROUP BY a.id, a.account_number, a.owner_name, a.balance, a.status, a.created_at, a.updated_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_summary_id ON account_balances_summary(id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_account_balances_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY account_balances_summary;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data
INSERT INTO accounts (id, account_number, owner_name, balance, version) 
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'ACC001', 'John Doe', 1000.00, 1),
    ('550e8400-e29b-41d4-a716-446655440002', 'ACC002', 'Jane Smith', 2000.00, 1)
ON CONFLICT (id) DO NOTHING;

-- Insert some sample transactions for testing
INSERT INTO transactions (account_id, transaction_type, amount, description, transaction_id, status, created_at)
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'DEPOSIT', 1000.00, 'Initial deposit', 'TXN-INIT-001', 'COMPLETED', NOW() - INTERVAL '30 days'),
    ('550e8400-e29b-41d4-a716-446655440002', 'DEPOSIT', 2000.00, 'Initial deposit', 'TXN-INIT-002', 'COMPLETED', NOW() - INTERVAL '30 days'),
    ('550e8400-e29b-41d4-a716-446655440001', 'WITHDRAWAL', 200.00, 'ATM withdrawal', 'TXN-ATM-001', 'COMPLETED', NOW() - INTERVAL '7 days'),
    ('550e8400-e29b-41d4-a716-446655440001', 'TRANSFER_OUT', 300.00, 'Transfer to Jane', 'TXN-TRANS-001', 'COMPLETED', NOW() - INTERVAL '5 days'),
    ('550e8400-e29b-41d4-a716-446655440002', 'TRANSFER_IN', 300.00, 'Transfer from John', 'TXN-TRANS-001', 'COMPLETED', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- Refresh the materialized view
SELECT refresh_account_balances_summary();
