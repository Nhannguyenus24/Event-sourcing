import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Command Status')
@Controller('command-status')
export class CommandStatusController {
  @Get(':commandId')
  @ApiOperation({ 
    summary: 'Get command execution status',
    description: 'Retrieves the current status of a command execution'
  })
  @ApiParam({ 
    name: 'commandId', 
    description: 'Command ID to check status for',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Command status retrieved successfully',
    schema: {
      example: {
        commandId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'COMPLETED',
        message: 'Command executed successfully',
        timestamp: '2025-01-15T10:30:00.000Z'
      }
    }
  })
  async getCommandStatus(@Param('commandId') commandId: string) {
    // For now, return a simple status
    // In a real implementation, you would track command execution status
    return {
      commandId,
      status: 'COMPLETED',
      message: 'Command executed successfully',
      timestamp: new Date().toISOString()
    };
  }
}
