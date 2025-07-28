import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import {
  SagaInstance,
  SagaStep,
  SagaStepDefinition,
  SagaEvent,
  SagaStatus,
  SagaStepStatus,
  SagaStepType,
} from '../dto/saga.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SagaDatabaseClient {
  private readonly logger = new Logger(SagaDatabaseClient.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL') || 
        'postgresql://postgres:password@localhost:5432/event_store',
    });
  }

  // ============================================================================
  // SAGA INSTANCES OPERATIONS
  // ============================================================================

  async createSagaInstance(sagaData: {
    sagaType: string;
    correlationId: string;
    payload: any;
    totalSteps: number;
    timeoutMinutes?: number;
    createdBy?: string;
    metadata?: any;
  }): Promise<SagaInstance> {
    const sagaId = uuidv4();
    const timeoutAt = sagaData.timeoutMinutes 
      ? new Date(Date.now() + sagaData.timeoutMinutes * 60 * 1000)
      : new Date(Date.now() + 30 * 60 * 1000); // Default 30 minutes

    const query = `
      INSERT INTO saga_instances (
        saga_id, saga_type, correlation_id, payload, total_steps, 
        timeout_at, created_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        sagaId,
        sagaData.sagaType,
        sagaData.correlationId,
        JSON.stringify(sagaData.payload),
        sagaData.totalSteps,
        timeoutAt,
        sagaData.createdBy || 'system',
        JSON.stringify(sagaData.metadata || {}),
      ]);

      this.logger.debug(`Created saga instance: ${sagaId}`);
      return this.mapToSagaInstance(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to create saga instance: ${error.message}`);
      throw error;
    }
  }

  async getSagaInstance(sagaId: string): Promise<SagaInstance | null> {
    const query = 'SELECT * FROM saga_instances WHERE saga_id = $1';
    
    try {
      const result = await this.pool.query(query, [sagaId]);
      return result.rows.length > 0 ? this.mapToSagaInstance(result.rows[0]) : null;
    } catch (error) {
      this.logger.error(`Failed to get saga instance ${sagaId}: ${error.message}`);
      throw error;
    }
  }

  async updateSagaStatus(
    sagaId: string,
    status: SagaStatus,
    currentStep?: number,
    errorMessage?: string,
  ): Promise<void> {
    const completedAt = status === SagaStatus.COMPLETED || status === SagaStatus.COMPENSATED 
      ? new Date() : null;

    const query = `
      UPDATE saga_instances 
      SET status = $2, current_step = COALESCE($3, current_step), 
          error_message = $4, completed_at = $5
      WHERE saga_id = $1
    `;

    try {
      await this.pool.query(query, [sagaId, status, currentStep, errorMessage, completedAt]);
      this.logger.debug(`Updated saga ${sagaId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update saga status: ${error.message}`);
      throw error;
    }
  }

  async incrementSagaRetryCount(sagaId: string): Promise<void> {
    const query = 'UPDATE saga_instances SET retry_count = retry_count + 1 WHERE saga_id = $1';
    
    try {
      await this.pool.query(query, [sagaId]);
    } catch (error) {
      this.logger.error(`Failed to increment retry count: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // SAGA STEPS OPERATIONS
  // ============================================================================

  async createSagaStep(stepData: {
    sagaId: string;
    stepNumber: number;
    stepName: string;
    stepType: SagaStepType;
    inputData?: any;
    compensationStepId?: string;
  }): Promise<SagaStep> {
    const stepId = uuidv4();
    
    const query = `
      INSERT INTO saga_steps (
        step_id, saga_id, step_number, step_name, step_type, 
        input_data, compensation_step_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        stepId,
        stepData.sagaId,
        stepData.stepNumber,
        stepData.stepName,
        stepData.stepType,
        JSON.stringify(stepData.inputData || {}),
        stepData.compensationStepId,
      ]);

      return this.mapToSagaStep(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to create saga step: ${error.message}`);
      throw error;
    }
  }

  async getSagaSteps(sagaId: string, stepType?: SagaStepType): Promise<SagaStep[]> {
    let query = 'SELECT * FROM saga_steps WHERE saga_id = $1';
    const params = [sagaId];

    if (stepType) {
      query += ' AND step_type = $2';
      params.push(stepType);
    }

    query += ' ORDER BY step_number ASC';

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map(row => this.mapToSagaStep(row));
    } catch (error) {
      this.logger.error(`Failed to get saga steps: ${error.message}`);
      throw error;
    }
  }

  async updateSagaStepStatus(
    stepId: string,
    status: SagaStepStatus,
    outputData?: any,
    eventIds?: string[],
    errorMessage?: string,
  ): Promise<void> {
    const startedAt = status === SagaStepStatus.EXECUTING ? new Date() : null;
    const completedAt = [SagaStepStatus.COMPLETED, SagaStepStatus.FAILED, SagaStepStatus.COMPENSATED]
      .includes(status) ? new Date() : null;

    const query = `
      UPDATE saga_steps 
      SET status = $2, output_data = $3, event_ids = $4, error_message = $5,
          started_at = COALESCE($6, started_at), completed_at = $7
      WHERE step_id = $1
    `;

    try {
      await this.pool.query(query, [
        stepId,
        status,
        JSON.stringify(outputData || {}),
        JSON.stringify(eventIds || []),
        errorMessage,
        startedAt,
        completedAt,
      ]);

      this.logger.debug(`Updated step ${stepId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update step status: ${error.message}`);
      throw error;
    }
  }

  async incrementStepRetryCount(stepId: string): Promise<void> {
    const query = 'UPDATE saga_steps SET retry_count = retry_count + 1 WHERE step_id = $1';
    
    try {
      await this.pool.query(query, [stepId]);
    } catch (error) {
      this.logger.error(`Failed to increment step retry count: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // SAGA STEP DEFINITIONS
  // ============================================================================

  async getSagaStepDefinitions(sagaType: string): Promise<SagaStepDefinition[]> {
    const query = `
      SELECT * FROM saga_step_definitions 
      WHERE saga_type = $1 
      ORDER BY step_number ASC
    `;

    try {
      const result = await this.pool.query(query, [sagaType]);
      return result.rows.map(row => this.mapToSagaStepDefinition(row));
    } catch (error) {
      this.logger.error(`Failed to get step definitions: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // SAGA EVENTS
  // ============================================================================

  async createSagaEvent(eventData: {
    sagaId: string;
    eventType: string;
    eventData: any;
  }): Promise<SagaEvent> {
    const eventId = uuidv4();
    
    const query = `
      INSERT INTO saga_events (event_id, saga_id, event_type, event_data)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        eventId,
        eventData.sagaId,
        eventData.eventType,
        JSON.stringify(eventData.eventData),
      ]);

      return this.mapToSagaEvent(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to create saga event: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // SAGA MONITORING & QUERIES
  // ============================================================================

  async getTimeoutSagas(): Promise<SagaInstance[]> {
    const query = `
      SELECT * FROM saga_instances 
      WHERE status IN ('STARTED', 'COMPENSATING') 
      AND timeout_at < NOW()
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapToSagaInstance(row));
    } catch (error) {
      this.logger.error(`Failed to get timeout sagas: ${error.message}`);
      throw error;
    }
  }

  async getSagaStatus(sagaId: string): Promise<any> {
    const query = 'SELECT * FROM saga_status_view WHERE saga_id = $1';
    
    try {
      const result = await this.pool.query(query, [sagaId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get saga status: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private mapToSagaInstance(row: any): SagaInstance {
    return {
      saga_id: row.saga_id,
      saga_type: row.saga_type,
      status: row.status as SagaStatus,
      correlation_id: row.correlation_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      current_step: row.current_step,
      total_steps: row.total_steps,
      started_at: row.started_at,
      completed_at: row.completed_at,
      timeout_at: row.timeout_at,
      error_message: row.error_message,
      retry_count: row.retry_count,
      created_by: row.created_by,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }

  private mapToSagaStep(row: any): SagaStep {
    return {
      step_id: row.step_id,
      saga_id: row.saga_id,
      step_number: row.step_number,
      step_name: row.step_name,
      step_type: row.step_type as SagaStepType,
      status: row.status as SagaStepStatus,
      input_data: typeof row.input_data === 'string' ? JSON.parse(row.input_data) : row.input_data,
      output_data: typeof row.output_data === 'string' ? JSON.parse(row.output_data) : row.output_data,
      event_ids: typeof row.event_ids === 'string' ? JSON.parse(row.event_ids) : row.event_ids,
      started_at: row.started_at,
      completed_at: row.completed_at,
      error_message: row.error_message,
      retry_count: row.retry_count,
      compensation_step_id: row.compensation_step_id,
    };
  }

  private mapToSagaStepDefinition(row: any): SagaStepDefinition {
    return {
      definition_id: row.definition_id,
      saga_type: row.saga_type,
      step_number: row.step_number,
      step_name: row.step_name,
      step_description: row.step_description,
      compensation_step_name: row.compensation_step_name,
      is_compensatable: row.is_compensatable,
      timeout_seconds: row.timeout_seconds,
      max_retries: row.max_retries,
    };
  }

  private mapToSagaEvent(row: any): SagaEvent {
    return {
      event_id: row.event_id,
      saga_id: row.saga_id,
      event_type: row.event_type,
      event_data: typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data,
      created_at: row.created_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 