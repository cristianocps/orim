import { Client } from 'minio';
import { config } from './config.js';

export const minioClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(config.minio.bucket);
  if (!exists) {
    await minioClient.makeBucket(config.minio.bucket);
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${config.minio.bucket}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(config.minio.bucket, JSON.stringify(policy));
  }
}
