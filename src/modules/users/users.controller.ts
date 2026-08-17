import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import type { RequestUser } from '@shared/types/api-response.types';
import type { PaginationQuery } from '@shared/types/pagination.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import type { PaginatedResult } from '@shared/types/pagination.types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(dto);
    return new UserResponseDto(user);
  }

  @Get()
  async findAll(
    @Query() query: Partial<PaginationQuery>,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.usersService.findAll(query);
    return {
      items: result.items.map((u) => new UserResponseDto(u)),
      pagination: result.pagination,
    };
  }

  @Get('me')
  async getMe(@CurrentUser() user: RequestUser): Promise<UserResponseDto> {
    const found = await this.usersService.findOne(user.id);
    return new UserResponseDto(found);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return new UserResponseDto(user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    // Users can only update themselves; ADMINs can update anyone
    if (requestUser.role !== Role.ADMIN && requestUser.id !== id) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('You can only update your own profile');
    }
    const user = await this.usersService.update(id, dto);
    return new UserResponseDto(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() requestUser: RequestUser): Promise<void> {
    if (requestUser.role !== Role.ADMIN && requestUser.id !== id) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('You can only delete your own account');
    }
    await this.usersService.remove(id);
  }
}
