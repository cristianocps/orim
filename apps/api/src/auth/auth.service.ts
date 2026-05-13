import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { config } from '../common/config.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await this.verifyPassword(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  signAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: '7d' });
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  }

  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, config.jwtRefreshSecret) as { userId: string };
  }

  setAuthCookies(reply: any, accessToken: string, refreshToken: string) {
    reply.setCookie('access_token', accessToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(reply: any) {
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
  }
}
