const axios = require('axios');
const { Client } = require('pg');

// API endpoints
const ACCOUNT_COMMAND_URL = 'http://localhost:3001/api/commands';
const EVENT_STORE_URL = 'http://localhost:3002/api/event-store';

// Database configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'event_store',
  user: 'postgres',
  password: 'password',
};

// Test scenario definitions
const TEST_SCENARIOS = {
  HAPPY_PATH: 'happy_path',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  INVALID_ACCOUNT: 'invalid_account',
  LARGE_AMOUNT: 'large_amount',
  SAGA_MONITORING: 'saga_monitoring'
};

class SagaTestSuite {
  constructor() {
    this.dbClient = null;
    this.testAccounts = [];
  }

  async connect() {
    this.dbClient = new Client(DB_CONFIG);
    await this.dbClient.connect();
    console.log('🔗 Connected to PostgreSQL for saga monitoring');
  }

  async disconnect() {
    if (this.dbClient) {
      await this.dbClient.end();
      console.log('💾 Disconnected from PostgreSQL');
    }
  }

  async setupTestAccounts() {
    console.log('\n📝 Setting up test accounts...');
    
    // Create account with sufficient funds
    const richAccount = await axios.post(`${ACCOUNT_COMMAND_URL}/create-account`, {
      accountNumber: `SAGA_RICH_${Date.now()}`,
      ownerName: 'Rich Saga User',
      initialBalance: 100000
    });

    // Create account with insufficient funds
    const poorAccount = await axios.post(`${ACCOUNT_COMMAND_URL}/create-account`, {
      accountNumber: `SAGA_POOR_${Date.now()}`,
      ownerName: 'Poor Saga User',
      initialBalance: 100
    });

    // Create normal account
    const normalAccount = await axios.post(`${ACCOUNT_COMMAND_URL}/create-account`, {
      accountNumber: `SAGA_NORMAL_${Date.now()}`,
      ownerName: 'Normal Saga User',
      initialBalance: 5000
    });

    this.testAccounts = {
      rich: richAccount.data.data.accountId,
      poor: poorAccount.data.data.accountId,
      normal: normalAccount.data.data.accountId
    };

    console.log('✅ Test accounts created:');
    console.log(`   Rich Account: ${this.testAccounts.rich} (100,000)`);
    console.log(`   Poor Account: ${this.testAccounts.poor} (100)`);
    console.log(`   Normal Account: ${this.testAccounts.normal} (5,000)`);

    return this.testAccounts;
  }

  async getSagaStatus(sagaId) {
    if (!this.dbClient) return null;

    try {
      const result = await this.dbClient.query(
        'SELECT * FROM saga_instances WHERE saga_id = $1',
        [sagaId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.log('❌ Cannot query saga status:', error.message);
      return null;
    }
  }

  async findSagaByCorrelationId(correlationId) {
    if (!this.dbClient) return null;

    try {
      const result = await this.dbClient.query(
        'SELECT * FROM saga_instances WHERE correlation_id = $1 ORDER BY started_at DESC LIMIT 1',
        [correlationId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.log('❌ Cannot find saga by correlation ID:', error.message);
      return null;
    }
  }

  async getSagaSteps(sagaId) {
    if (!this.dbClient) return [];

    try {
      const result = await this.dbClient.query(
        'SELECT * FROM saga_steps WHERE saga_id = $1 ORDER BY step_number',
        [sagaId]
      );
      return result.rows;
    } catch (error) {
      console.log('❌ Cannot query saga steps:', error.message);
      return [];
    }
  }

  async getAllSagas(limit = 10) {
    if (!this.dbClient) return [];

    try {
      const result = await this.dbClient.query(`
        SELECT saga_id, saga_type, status, correlation_id, 
               current_step, total_steps, started_at, error_message
        FROM saga_instances 
        ORDER BY started_at DESC 
        LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (error) {
      console.log('❌ Cannot query all sagas:', error.message);
      return [];
    }
  }

  async waitForSagaCompletion(sagaId, timeoutMs = 10000) {
    const startTime = Date.now();
    let finalStatus = null;

    console.log(`⏳ Waiting for saga ${sagaId.substring(0, 8)}... to complete`);

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getSagaStatus(sagaId);
      if (!status) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      finalStatus = status;
      
      if (['COMPLETED', 'FAILED', 'COMPENSATED'].includes(status.status)) {
        console.log(`✅ Saga completed with status: ${status.status}`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return finalStatus;
  }

  async monitorSagaExecution(sagaId) {
    console.log(`\n🔍 Monitoring saga execution: ${sagaId.substring(0, 8)}...`);
    
    let previousStepCount = 0;
    const maxWaitTime = 15000; // 15 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const steps = await this.getSagaSteps(sagaId);
      const status = await this.getSagaStatus(sagaId);

      if (steps.length > previousStepCount) {
        const newSteps = steps.slice(previousStepCount);
        newSteps.forEach(step => {
          console.log(`   📍 Step ${step.step_number}: ${step.step_name} → ${step.status}`);
          if (step.error_message) {
            console.log(`      ❌ Error: ${step.error_message}`);
          }
        });
        previousStepCount = steps.length;
      }

      if (status && ['COMPLETED', 'FAILED', 'COMPENSATED'].includes(status.status)) {
        console.log(`\n🏁 Final saga status: ${status.status}`);
        if (status.error_message) {
          console.log(`   Error: ${status.error_message}`);
        }
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return await this.getSagaStatus(sagaId);
  }

  // Test Case 1: Happy Path - Successful Transfer
  async testHappyPath() {
    console.log('\n🌟 TEST 1: Happy Path - Successful Transfer');
    console.log('═'.repeat(50));

    try {
      const { rich, normal } = this.testAccounts;

      // Get initial balances
      const balance1Before = await axios.get(`${ACCOUNT_COMMAND_URL}/account/${rich}/balance`);
      const balance2Before = await axios.get(`${ACCOUNT_COMMAND_URL}/account/${normal}/balance`);
      
      console.log(`Before - Rich: ${balance1Before.data.data.balance}, Normal: ${balance2Before.data.data.balance}`);

      // Execute transfer
      const transferResponse = await axios.post(`${ACCOUNT_COMMAND_URL}/transfer`, {
        fromAccountId: rich,
        toAccountId: normal,
        amount: 1000,
        description: 'Happy path saga test'
      });

      console.log('Transfer response:', JSON.stringify(transferResponse.data, null, 2));
      
      // Use transferRequestId as correlation ID to find saga
      const transferRequestId = transferResponse.data.data.transferRequestId;
      console.log(`Transfer initiated. Request ID: ${transferRequestId}`);
      
      // Wait a moment for saga to be created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find saga by correlation ID
      const saga = await this.findSagaByCorrelationId(transferRequestId);
      if (saga) {
        console.log(`Found saga: ${saga.saga_id.substring(0, 8)}...`);
        await this.monitorSagaExecution(saga.saga_id);
      } else {
        console.log('❌ No saga found for this transfer request');
        return;
      }

      // Check final balances
      await new Promise(resolve => setTimeout(resolve, 2000));
      const balance1After = await axios.get(`${ACCOUNT_COMMAND_URL}/account/${rich}/balance`);
      const balance2After = await axios.get(`${ACCOUNT_COMMAND_URL}/account/${normal}/balance`);
      
      console.log(`After - Rich: ${balance1After.data.data.balance}, Normal: ${balance2After.data.data.balance}`);

      const expectedAmount1 = balance1Before.data.data.balance - 1000;
      const expectedAmount2 = balance2Before.data.data.balance + 1000;

      if (balance1After.data.data.balance === expectedAmount1 && 
          balance2After.data.data.balance === expectedAmount2) {
        console.log('✅ PASS: Happy path transfer successful!');
      } else {
        console.log('❌ FAIL: Balances not updated correctly');
      }

    } catch (error) {
      console.log('❌ FAIL: Happy path test failed:', error.message);
    }
  }

  // Test Case 2: Insufficient Funds - Should Fail at Validation
  async testInsufficientFunds() {
    console.log('\n💸 TEST 2: Insufficient Funds - Validation Failure');
    console.log('═'.repeat(50));

    try {
      const { poor, normal } = this.testAccounts;

      // Try to transfer more than available
      const transferResponse = await axios.post(`${ACCOUNT_COMMAND_URL}/transfer`, {
        fromAccountId: poor,
        toAccountId: normal,
        amount: 5000, // Poor account only has 100
        description: 'Insufficient funds saga test'
      });

             const transferRequestId = transferResponse.data.data.transferRequestId;
       console.log(`Transfer initiated. Request ID: ${transferRequestId}`);
       
       // Wait for saga creation
       await new Promise(resolve => setTimeout(resolve, 2000));
       
       // Find saga and monitor
       const saga = await this.findSagaByCorrelationId(transferRequestId);
       if (!saga) {
         console.log('❌ No saga found for this transfer request');
         return;
       }
       
       const finalStatus = await this.monitorSagaExecution(saga.saga_id);

       if (finalStatus && finalStatus.status === 'FAILED') {
         console.log('✅ PASS: Saga correctly failed due to insufficient funds');
       } else {
         console.log('❌ FAIL: Saga should have failed but didn\'t');
       }

    } catch (error) {
      console.log('❌ FAIL: Insufficient funds test failed:', error.message);
    }
  }

  // Test Case 3: Invalid Account - Should Fail at Validation
  async testInvalidAccount() {
    console.log('\n🚫 TEST 3: Invalid Account - Validation Failure');
    console.log('═'.repeat(50));

    try {
      const { normal } = this.testAccounts;
      const fakeAccountId = '00000000-1111-2222-3333-444444444444';

      // Try to transfer to non-existent account
      const transferResponse = await axios.post(`${ACCOUNT_COMMAND_URL}/transfer`, {
        fromAccountId: normal,
        toAccountId: fakeAccountId,
        amount: 500,
        description: 'Invalid account saga test'
      });

             const transferRequestId = transferResponse.data.data.transferRequestId;
       console.log(`Transfer initiated. Request ID: ${transferRequestId}`);
       
       // Wait for saga creation
       await new Promise(resolve => setTimeout(resolve, 2000));
       
       // Find saga and monitor
       const saga = await this.findSagaByCorrelationId(transferRequestId);
       if (!saga) {
         console.log('❌ No saga found for this transfer request');
         return;
       }
       
       const finalStatus = await this.monitorSagaExecution(saga.saga_id);

       if (finalStatus && finalStatus.status === 'FAILED') {
         console.log('✅ PASS: Saga correctly failed due to invalid account');
       } else {
         console.log('❌ FAIL: Saga should have failed but didn\'t');
       }

    } catch (error) {
      console.log('❌ FAIL: Invalid account test failed:', error.message);
    }
  }

  // Test Case 4: Large Amount - Business Rule Validation
  async testLargeAmount() {
    console.log('\n💰 TEST 4: Large Amount - Business Rule Validation');
    console.log('═'.repeat(50));

    try {
      const { rich, normal } = this.testAccounts;

      // Try to transfer amount exceeding limit (>1,000,000)
      const transferResponse = await axios.post(`${ACCOUNT_COMMAND_URL}/transfer`, {
        fromAccountId: rich,
        toAccountId: normal,
        amount: 1500000, // Exceeds 1M limit
        description: 'Large amount saga test'
      });

             const transferRequestId = transferResponse.data.data.transferRequestId;
       console.log(`Transfer initiated. Request ID: ${transferRequestId}`);
       
       // Wait for saga creation
       await new Promise(resolve => setTimeout(resolve, 2000));
       
       // Find saga and monitor
       const saga = await this.findSagaByCorrelationId(transferRequestId);
       if (!saga) {
         console.log('❌ No saga found for this transfer request');
         return;
       }
       
       const finalStatus = await this.monitorSagaExecution(saga.saga_id);

       if (finalStatus && finalStatus.status === 'FAILED') {
         console.log('✅ PASS: Saga correctly failed due to amount limit');
       } else {
         console.log('❌ FAIL: Saga should have failed but didn\'t');
       }

    } catch (error) {
      console.log('❌ FAIL: Large amount test failed:', error.message);
    }
  }

  // Test Case 5: Saga Monitoring and Status Tracking
  async testSagaMonitoring() {
    console.log('\n📊 TEST 5: Saga Monitoring and Status Tracking');
    console.log('═'.repeat(50));

    try {
      console.log('Recent sagas in the system:');
      const recentSagas = await this.getAllSagas(5);
      
      if (recentSagas.length === 0) {
        console.log('No sagas found in database');
        return;
      }

      recentSagas.forEach((saga, index) => {
        console.log(`\n${index + 1}. Saga ${saga.saga_id.substring(0, 8)}...`);
        console.log(`   Type: ${saga.saga_type}`);
        console.log(`   Status: ${saga.status}`);
        console.log(`   Progress: ${saga.current_step}/${saga.total_steps}`);
        console.log(`   Started: ${new Date(saga.started_at).toLocaleString()}`);
        if (saga.error_message) {
          console.log(`   Error: ${saga.error_message}`);
        }
      });

      // Show detailed steps for the most recent saga
      if (recentSagas.length > 0) {
        const latestSaga = recentSagas[0];
        console.log(`\nDetailed steps for latest saga (${latestSaga.saga_id.substring(0, 8)}...):`);
        
        const steps = await this.getSagaSteps(latestSaga.saga_id);
        steps.forEach(step => {
          console.log(`   ${step.step_number}. ${step.step_name} [${step.step_type}] → ${step.status}`);
          if (step.error_message) {
            console.log(`      Error: ${step.error_message}`);
          }
        });
      }

      console.log('✅ PASS: Saga monitoring test completed');

    } catch (error) {
      console.log('❌ FAIL: Saga monitoring test failed:', error.message);
    }
  }

  // Run all test scenarios
  async runAllTests() {
    console.log('🧪 SAGA PATTERN TEST SUITE');
    console.log('════════════════════════════════════════════════════════');
    console.log('Testing comprehensive saga scenarios with monitoring...\n');

    try {
      await this.connect();
      await this.setupTestAccounts();

      // Run test scenarios
      await this.testHappyPath();
      await this.testInsufficientFunds();
      await this.testInvalidAccount();
      await this.testLargeAmount();
      await this.testSagaMonitoring();

      console.log('\n🏁 TEST SUITE COMPLETED');
      console.log('═'.repeat(50));
      console.log('Check the results above for detailed analysis.');
      console.log('💡 TIP: Check database directly with:');
      console.log('   docker exec -it event-sourcing-postgres psql -U postgres -d event_store');
      console.log('   \\d saga_instances');
      console.log('   SELECT * FROM saga_instances ORDER BY started_at DESC;');

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    } finally {
      await this.disconnect();
    }
  }
}

// Check if script is run with specific test scenario
const scenario = process.argv[2];

async function main() {
  const testSuite = new SagaTestSuite();

  if (scenario && TEST_SCENARIOS[scenario.toUpperCase()]) {
    await testSuite.connect();
    await testSuite.setupTestAccounts();

    switch (scenario.toUpperCase()) {
      case 'HAPPY_PATH':
        await testSuite.testHappyPath();
        break;
      case 'INSUFFICIENT_FUNDS':
        await testSuite.testInsufficientFunds();
        break;
      case 'INVALID_ACCOUNT':
        await testSuite.testInvalidAccount();
        break;
      case 'LARGE_AMOUNT':
        await testSuite.testLargeAmount();
        break;
      case 'SAGA_MONITORING':
        await testSuite.testSagaMonitoring();
        break;
    }

    await testSuite.disconnect();
  } else {
    // Run full test suite
    await testSuite.runAllTests();
  }
}

// Run the tests
main().catch(console.error); 