import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: 'AUCTIONEER' | 'BIDDER';
  publicAlias: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);