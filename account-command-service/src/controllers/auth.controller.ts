import { Controller, Post, Body, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto, RegisterDto } from '../dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticates user credentials and returns JWT token'
  })
  @ApiBody({ 
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      'admin': {
        value: {
          username: 'admin',
          password: 'admin123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          username: 'admin'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  @ApiOperation({ 
    summary: 'User registration',
    description: 'Registers a new user and automatically creates a bank account with initial balance'
  })
  @ApiBody({ 
    type: RegisterDto,
    description: 'User registration data',
    examples: {
      'newUser': {
        value: {
          username: 'johndoe123',
          fullName: 'John Doe',
          password: 'securepassword123',
          initialBalance: 1000
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Registration successful',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'uuid-here',
          username: 'johndoe123',
          role: 'user'
        },
        account: {
          accountId: 'account-uuid-here',
          accountNumber: 'ACC123456789',
          balance: 1000
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - User already exists or invalid data' })
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      return result;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
