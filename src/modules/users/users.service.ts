import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserEntity } from './entities/user.entity';
import { UsersRepository } from './repositories/users.repository';
import { hashPassword } from '@shared/utils/hash.util';
import type { PaginatedResult, PaginationQuery } from '@shared/types/pagination.types';
import { normalizePaginationQuery } from '@shared/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const exists = await this.usersRepository.exists({ email: dto.email });
    if (exists) throw new ConflictException('Email is already registered');

    const hashed = await hashPassword(dto.password);
    return this.usersRepository.create({
      email: dto.email,
      password: hashed,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });
  }

  async findAll(rawQuery: Partial<PaginationQuery>): Promise<PaginatedResult<UserEntity>> {
    const query = normalizePaginationQuery(rawQuery);
    return this.usersRepository.findMany(query);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.findOne(id);

    if (dto.email) {
      const conflict = await this.usersRepository.findByEmail(dto.email);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Email is already in use');
      }
    }

    return this.usersRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.usersRepository.delete(id);
  }
}
