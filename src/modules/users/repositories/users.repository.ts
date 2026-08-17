import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma/prisma.service';
import { UserEntity } from '../entities/user.entity';
import type { PaginatedResult, PaginationQuery } from '@shared/types/pagination.types';
import { buildPaginationMeta, toPrismaSkipTake } from '@shared/utils/pagination.util';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<UserEntity> {
    const user = await this.prisma.user.create({ data });
    return new UserEntity(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? new UserEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? new UserEntity(user) : null;
  }

  async findMany(
    query: PaginationQuery,
    where?: Prisma.UserWhereInput,
  ): Promise<PaginatedResult<UserEntity>> {
    const { skip, take } = toPrismaSkipTake(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder ?? 'desc' }
          : { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => new UserEntity(u)),
      pagination: buildPaginationMeta(total, query),
    };
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserEntity> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return new UserEntity(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async exists(where: Prisma.UserWhereUniqueInput): Promise<boolean> {
    const count = await this.prisma.user.count({ where });
    return count > 0;
  }
}
