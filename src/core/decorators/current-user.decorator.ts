import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '@shared/types/api-response.types';

export const CurrentUser = createParamDecorator(
  (
    field: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
    return field ? request.user[field] : request.user;
  },
);
