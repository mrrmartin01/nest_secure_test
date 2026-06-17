import { Exclude, Expose } from 'class-transformer';
import type { Role, User as PrismaUser } from '@prisma/client';

@Exclude()
export class UserEntity implements PrismaUser {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  password!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  role!: Role;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  constructor(partial: PrismaUser) {
    Object.assign(this, partial);
  }

  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
