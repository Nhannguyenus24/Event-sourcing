import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';

export class LoginDto {
  username: string;
  password: string;
}

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
}
