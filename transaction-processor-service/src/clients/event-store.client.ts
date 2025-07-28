/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AccountBalance } from '../dto/transfer-events.dto';

@Injectable()
export class EventStoreClient {
  private readonly logger = new Logger(EventStoreClient.name);
  private readonly eventStoreUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.eventStoreUrl =
      this.configService.get<string>('EVENT_STORE_URL') ||
      'http://localhost:3002';
  }

  async getAccountEvents(accountId: string): Promise<any[]> {
    try {
      this.logger.debug(`Fetching events for account: ${accountId}`);

      const response = await axios.get(
        `${this.eventStoreUrl}/api/event-store/stream/${accountId}`,
      );

      this.logger.debug(
        `Found ${response.data.events?.length || 0} events for account ${accountId}`,
      );
      return response.data.events || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch events for account ${accountId}:`,
        error.message,
      );
      throw new Error(`Cannot fetch account events: ${error.message}`);
    }
  }

  async calculateAccountBalance(accountId: string): Promise<AccountBalance> {
    try {
      const events = await this.getAccountEvents(accountId);

      if (events.length === 0) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Rebuild account state from events
      let balance = 0;
      let accountNumber = '';
      let ownerName = '';
      let status = 'ACTIVE';
      let version = 0;

      for (const event of events) {
        version = Math.max(version, event.version || 0);

        switch (event.event_type || event.eventType) {
          case 'AccountCreated':
            const createData = event.event_data || event.eventData;
            balance = createData.initialBalance || 0;
            accountNumber = createData.accountNumber;
            ownerName = createData.ownerName;
            break;

          case 'MoneyDeposited':
            const depositData = event.event_data || event.eventData;
            balance += depositData.amount;
            break;

          case 'MoneyWithdrawn':
            const withdrawData = event.event_data || event.eventData;
            balance -= withdrawData.amount;
            break;

          case 'MoneyTransferred':
            const transferData = event.event_data || event.eventData;
            balance -= transferData.amount;
            break;

          case 'MoneyReceived':
            const receiveData = event.event_data || event.eventData;
            balance += receiveData.amount;
            break;

          case 'AccountBlocked':
            status = 'BLOCKED';
            break;
        }
      }

      this.logger.debug(`Account ${accountId} balance calculated: ${balance}`);

      return {
        accountId,
        accountNumber,
        ownerName,
        balance,
        status,
        version,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate balance for account ${accountId}:`,
        error.message,
      );
      throw error;
    }
  }

  async appendEvents(
    streamId: string,
    events: any[],
    expectedVersion: number,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Appending ${events.length} events to stream ${streamId}`,
      );

      await axios.post(`${this.eventStoreUrl}/api/event-store/append`, {
        streamId,
        events,
        expectedVersion,
      });

      this.logger.debug(`Successfully appended events to stream ${streamId}`);
    } catch (error) {
      this.logger.error(
        `Failed to append events to stream ${streamId}:`,
        error.message,
      );
      throw new Error(`Cannot append events: ${error.message}`);
    }
  }
}
