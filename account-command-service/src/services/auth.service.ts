import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AccountCommandService } from './account-command.service';
import { CreateAccountCommand } from '../commands/commands';
import { RegisterDto } from '../dto/auth.dto';

export interface User {
  id: string;
  username: string;
  password: string;
  role: string;
  fullName?: string;
}

@Injectable()
export class AuthService {
  private users: User[] = [
    {
      id: '1',
      username: 'admin',
      password: '$2b$10$XHZy8XdBV8vu7E4j5k0xwu1mK5y8VHZy8XdBV8vu7E4j5k0xwu1mK', // 'password'
      role: 'admin',
      fullName: 'Administrator'
    },
    {
      id: '2',
      username: 'user',
      password: '$2b$10$XHZy8XdBV8vu7E4j5k0xwu1mK5y8VHZy8XdBV8vu7E4j5k0xwu1mK', // 'password'
      role: 'user',
      fullName: 'Test User'
    }
  ];

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => AccountCommandService))
    private accountCommandService: AccountCommandService
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = this.users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      }
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = this.users.find(u => u.username === registerDto.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Create new user
    const userId = uuidv4();
    const newUser: User = {
      id: userId,
      username: registerDto.username,
      password: hashedPassword,
      role: 'user',
      fullName: registerDto.fullName
    };

    // Add user to in-memory store
    this.users.push(newUser);

    // Create bank account for the user
    const accountId = uuidv4();
    const accountNumber = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    const createAccountCommand = new CreateAccountCommand(
      uuidv4(),
      accountId,
      accountNumber,
      registerDto.fullName,
      registerDto.initialBalance || 1000
    );

    const accountResult = await this.accountCommandService.createAccount(createAccountCommand);
    
    if (!accountResult.success) {
      // Remove user if account creation failed
      const userIndex = this.users.findIndex(u => u.id === userId);
      if (userIndex > -1) {
        this.users.splice(userIndex, 1);
      }
      throw new Error(`Failed to create account: ${accountResult.message}`);
    }

    // Generate JWT token
    const { password, ...userWithoutPassword } = newUser;
    const loginResult = await this.login(userWithoutPassword);

    return {
      ...loginResult,
      account: accountResult.data
    };
  }
}
