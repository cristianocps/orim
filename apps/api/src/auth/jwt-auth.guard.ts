import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.access_token;
    if (!token) throw new UnauthorizedException('No access token');
    try {
      const decoded = this.authService.verifyAccessToken(token);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
