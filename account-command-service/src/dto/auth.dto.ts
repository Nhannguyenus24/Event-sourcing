import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'Username for authentication',
    example: 'admin'
  })
  @IsString()
  username: string;

  @ApiProperty({ 
    description: 'Password for authentication',
    example: 'admin123'
  })
  @IsString()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ 
    description: 'Username for the new account',
    example: 'johndoe123',
    maxLength: 50
  })
  @IsString()
  username: string;

  @ApiProperty({ 
    description: 'Full name of the user',
    example: 'John Doe',
    maxLength: 255
  })
  @IsString()
  fullName: string;

  @ApiProperty({ 
    description: 'Password for the new account',
    example: 'securepassword123',
    minLength: 6
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({ 
    description: 'Initial balance for the bank account',
    example: 1000,
    minimum: 0,
    default: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number = 1000;
}