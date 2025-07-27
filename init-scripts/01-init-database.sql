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

-- ============================================================================
-- SAGA PATTERN TABLES FOR FULL COMPENSATION LOGIC
-- ============================================================================

-- Saga instances table to track long-running transactions
CREATE TABLE IF NOT EXISTS saga_instances (
    saga_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type VARCHAR(50) NOT NULL, -- 'MONEY_TRANSFER', 'MULTI_STEP_PAYMENT', etc.
    status VARCHAR(20) NOT NULL DEFAULT 'STARTED', -- 'STARTED', 'COMPLETED', 'COMPENSATING', 'FAILED', 'COMPENSATED'
    correlation_id VARCHAR(255), -- Original transfer request ID
    payload JSONB NOT NULL, -- Store original request data
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_by VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for saga instances
CREATE INDEX IF NOT EXISTS idx_saga_instances_status ON saga_instances(status);
CREATE INDEX IF NOT EXISTS idx_saga_instances_type ON saga_instances(saga_type);
CREATE INDEX IF NOT EXISTS idx_saga_instances_correlation_id ON saga_instances(correlation_id);
CREATE INDEX IF NOT EXISTS idx_saga_instances_started_at ON saga_instances(started_at);
CREATE INDEX IF NOT EXISTS idx_saga_instances_timeout_at ON saga_instances(timeout_at);

-- Saga steps table to track individual steps within a saga
CREATE TABLE IF NOT EXISTS saga_steps (
    step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_id UUID NOT NULL,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(100) NOT NULL, -- 'WITHDRAW_FROM_SOURCE', 'DEPOSIT_TO_TARGET', etc.
    step_type VARCHAR(20) NOT NULL, -- 'FORWARD', 'COMPENSATION'
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'COMPENSATED'
    input_data JSONB, -- Data needed for this step
    output_data JSONB, -- Result data from step execution
    event_ids JSONB, -- Array of event IDs produced by this step
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    compensation_step_id UUID, -- Reference to the step that compensates this one
    FOREIGN KEY (saga_id) REFERENCES saga_instances(saga_id) ON DELETE CASCADE,
    UNIQUE(saga_id, step_number)
);

-- Indexes for saga steps
CREATE INDEX IF NOT EXISTS idx_saga_steps_saga_id ON saga_steps(saga_id);
CREATE INDEX IF NOT EXISTS idx_saga_steps_status ON saga_steps(status);
CREATE INDEX IF NOT EXISTS idx_saga_steps_type ON saga_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_saga_steps_compensation ON saga_steps(compensation_step_id);

-- Saga step definitions table (templates for different saga types)
CREATE TABLE IF NOT EXISTS saga_step_definitions (
    definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type VARCHAR(50) NOT NULL,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_description TEXT,
    compensation_step_name VARCHAR(100), -- Name of the compensation step
    is_compensatable BOOLEAN DEFAULT true,
    timeout_seconds INTEGER DEFAULT 300, -- 5 minutes default
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(saga_type, step_number)
);

-- Insert saga step definitions for money transfer
INSERT INTO saga_step_definitions (saga_type, step_number, step_name, step_description, compensation_step_name, is_compensatable, timeout_seconds, max_retries)
VALUES 
    ('MONEY_TRANSFER', 1, 'VALIDATE_TRANSFER', 'Validate transfer request and account states', NULL, false, 30, 3),
    ('MONEY_TRANSFER', 2, 'WITHDRAW_FROM_SOURCE', 'Withdraw money from source account', 'COMPENSATE_WITHDRAW', true, 60, 3),
    ('MONEY_TRANSFER', 3, 'DEPOSIT_TO_TARGET', 'Deposit money to target account', 'COMPENSATE_DEPOSIT', true, 60, 3),
    ('MONEY_TRANSFER', 4, 'FINALIZE_TRANSFER', 'Mark transfer as completed and send notifications', 'REVERSE_FINALIZATION', true, 30, 2)
ON CONFLICT (saga_type, step_number) DO NOTHING;

-- Saga events table to track saga-related events
CREATE TABLE IF NOT EXISTS saga_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'SAGA_STARTED', 'STEP_COMPLETED', 'SAGA_FAILED', 'COMPENSATION_STARTED', etc.
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (saga_id) REFERENCES saga_instances(saga_id) ON DELETE CASCADE
);

-- Indexes for saga events
CREATE INDEX IF NOT EXISTS idx_saga_events_saga_id ON saga_events(saga_id);
CREATE INDEX IF NOT EXISTS idx_saga_events_type ON saga_events(event_type);
CREATE INDEX IF NOT EXISTS idx_saga_events_created_at ON saga_events(created_at);

-- View for saga monitoring and debugging
CREATE VIEW saga_status_view AS
SELECT 
    si.saga_id,
    si.saga_type,
    si.status as saga_status,
    si.correlation_id,
    si.current_step,
    si.total_steps,
    si.started_at,
    si.completed_at,
    si.timeout_at,
    si.error_message,
    CASE 
        WHEN si.timeout_at IS NOT NULL AND si.timeout_at < NOW() THEN true
        ELSE false
    END as is_timeout,
    COUNT(ss.step_id) as total_steps_count,
    COUNT(CASE WHEN ss.status = 'COMPLETED' THEN 1 END) as completed_steps,
    COUNT(CASE WHEN ss.status = 'FAILED' THEN 1 END) as failed_steps,
    COUNT(CASE WHEN ss.status = 'COMPENSATED' THEN 1 END) as compensated_steps
FROM saga_instances si
LEFT JOIN saga_steps ss ON si.saga_id = ss.saga_id AND ss.step_type = 'FORWARD'
GROUP BY si.saga_id, si.saga_type, si.status, si.correlation_id, si.current_step, 
         si.total_steps, si.started_at, si.completed_at, si.timeout_at, si.error_message;

-- Function to cleanup old completed sagas (housekeeping)
CREATE OR REPLACE FUNCTION cleanup_old_sagas(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM saga_instances 
    WHERE status IN ('COMPLETED', 'COMPENSATED') 
    AND completed_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
