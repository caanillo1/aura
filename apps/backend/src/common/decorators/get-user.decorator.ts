import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  id: string;
  email: string;
  userType: string;
  role: string;
  companyId: string;
}

export const GetUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext): any => {
    const user: JwtUser = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);
