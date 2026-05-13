import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) reply: FastifyReply) {
    const data = registerSchema.parse(body);
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return reply.status(409).send({ error: 'Email already registered' });

    const password = await this.authService.hashPassword(data.password);
    const user = await this.prisma.user.create({
      data: { email: data.email, name: data.name, password },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const accessToken = this.authService.signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = this.authService.signRefreshToken(user.id);
    this.authService.setAuthCookies(reply, accessToken, refreshToken);

    return { user };
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) reply: FastifyReply) {
    const data = loginSchema.parse(body);
    const user = await this.authService.validateUser(data.email, data.password);

    const accessToken = this.authService.signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = this.authService.signRefreshToken(user.id);
    this.authService.setAuthCookies(reply, accessToken, refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    this.authService.clearAuthCookies(reply);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    return { user };
  }

  @Post('refresh')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refresh = (req as any).cookies?.refresh_token;
    if (!refresh) return reply.status(401).send({ error: 'No refresh token' });
    try {
      const decoded = this.authService.verifyRefreshToken(refresh);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true },
      });
      if (!user) throw new Error('User not found');
      const accessToken = this.authService.signAccessToken({ userId: user.id, email: user.email });
      this.authService.setAuthCookies(reply, accessToken, refresh);
      return { ok: true };
    } catch {
      this.authService.clearAuthCookies(reply);
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  }
}
