import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Exclude password from updates — password changes use a dedicated endpoint
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}
