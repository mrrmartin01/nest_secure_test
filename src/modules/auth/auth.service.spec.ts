import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserEntity } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import * as hashUtil from '@shared/utils/hash.util';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

const mockUser = {
  id: 'user-id-1',
  email: 'test@example.com',
  password: '$2b$12$hashedpassword',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fullName: 'John Doe',
} as unknown as UserEntity;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateCredentials', () => {
    it('returns null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.validateCredentials('test@example.com', 'password');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(false);

      const result = await service.validateCredentials('test@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('returns null when user account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false } as unknown as UserEntity;
      usersService.findByEmail.mockResolvedValue(inactiveUser);
      jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

      const result = await service.validateCredentials('test@example.com', 'password');
      expect(result).toBeNull();
    });

    it('returns user when credentials are valid and account is active', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

      const result = await service.validateCredentials('test@example.com', 'password');
      expect(result).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('issues a signed JWT and returns user response', async () => {
      const result = await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        password: 'Password1!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      usersService.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('signed-jwt-token');
    });

    it('propagates ConflictException when email is taken', async () => {
      usersService.create.mockRejectedValue(new ConflictException('Email is already registered'));
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });
});
