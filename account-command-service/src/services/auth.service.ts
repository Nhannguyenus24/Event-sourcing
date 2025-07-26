import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface User {
  id: string;
  username: string;
  password: string;
  role: string;
}

@Injectable()
export class AuthService {
  private users: User[] = [
    {
      id: '1',
      username: 'admin',
      password: '$2b$10$XHZy8XdBV8vu7E4j5k0xwu1mK5y8VHZy8XdBV8vu7E4j5k0xwu1mK', // 'password'
      role: 'admin'
    },
    {
      id: '2',
      username: 'user',
      password: '$2b$10$XHZy8XdBV8vu7E4j5k0xwu1mK5y8VHZy8XdBV8vu7E4j5k0xwu1mK', // 'password'
      role: 'user'
    }
  ];

  constructor(private jwtService: JwtService) {}

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
        role: user.role
      }
    };
  }
}
