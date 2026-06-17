import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserEntity } from './entities/user.entity';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';
import * as hashUtil from '@shared/utils/hash.util';
import type { CreateUserDto } from './dto/create-user.dto';

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

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            exists: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'new@example.com',
      password: 'Password1!',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    it('hashes the password and creates the user', async () => {
      repository.exists.mockResolvedValue(false);
      jest.spyOn(hashUtil, 'hashPassword').mockResolvedValue('hashed');
      repository.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(hashUtil.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed', email: dto.email }),
      );
      expect(result).toEqual(mockUser);
    });

    it('throws ConflictException when email is already registered', async () => {
      repository.exists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      repository.findById.mockResolvedValue(mockUser);
      const result = await service.findOne('user-id-1');
      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the user when found', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.findByEmail.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...mockUser, firstName: 'Updated' } as UserEntity);

      const result = await service.update('user-id-1', { firstName: 'Updated' });

      expect(repository.update).toHaveBeenCalledWith('user-id-1', { firstName: 'Updated' });
      expect(result.firstName).toBe('Updated');
    });

    it('throws ConflictException when new email belongs to another user', async () => {
      const otherUser = { ...mockUser, id: 'other-id' } as UserEntity;
      repository.findById.mockResolvedValue(mockUser);
      repository.findByEmail.mockResolvedValue(otherUser);

      await expect(service.update('user-id-1', { email: 'taken@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the user when found', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.delete.mockResolvedValue();
      await service.remove('user-id-1');
      expect(repository.delete).toHaveBeenCalledWith('user-id-1');
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
