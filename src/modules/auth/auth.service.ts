import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserEntity } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import type { RegisterDto } from './dto/register.dto';
import { comparePassword } from '@shared/utils/hash.util';
import type { JwtPayload } from '@shared/types/api-response.types';

export interface AuthTokens {
  accessToken: string;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return null;

    if (!user.isActive) return null;

    return user;
  }

  async login(user: UserEntity): Promise<AuthTokens> {
    return this.issueTokens(user);
  }

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const user = await this.usersService.create(dto);
    return this.issueTokens(user);
  }

  private issueTokens(user: UserEntity): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: new UserResponseDto(user),
    };
  }
}
