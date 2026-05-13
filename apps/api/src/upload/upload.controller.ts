import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { minioClient, ensureBucket } from '../common/minio.js';
import { config } from '../common/config.js';
import { randomUUID } from 'crypto';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor() {
    ensureBucket().catch(() => {});
  }

  @Post()
  async upload(@Req() req: any, @Res({ passthrough: true }) reply: FastifyReply) {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const ext = data.filename.split('.').pop() ?? 'bin';
    const objectName = `${randomUUID()}.${ext}`;

    await minioClient.putObject(config.minio.bucket, objectName, data.file, data.file.bytesRead, {
      'Content-Type': data.mimetype,
    });

    const url = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endPoint}:${config.minio.port}/${config.minio.bucket}/${objectName}`;
    return { url, objectName };
  }
}
