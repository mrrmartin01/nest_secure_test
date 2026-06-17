import { Exclude, Expose } from 'class-transformer';
import type { Role } from '@prisma/client';
import type { UserEntity } from '../entities/user.entity';

@Exclude()
export class UserResponseDto {
  @Expose() id!: string;
  @Expose() email!: string;
  @Expose() firstName!: string;
  @Expose() lastName!: string;
  @Expose() fullName!: string;
  @Expose() role!: Role;
  @Expose() isActive!: boolean;
  @Expose() createdAt!: Date;

  constructor(user: UserEntity) {
    Object.assign(this, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  }
}
