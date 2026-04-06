import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

export interface ImageUploadResult extends UploadResult {
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary credentials not fully configured. Cloudinary uploads will fail.',
      );
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.logger.log('Cloudinary configured successfully');
  }

  async uploadPdfBuffer(
    buffer: Buffer,
    publicId: string,
    folder: string = 'certificates',
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          public_id: publicId,
          folder,
          overwrite: true,
          format: 'pdf',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to upload PDF: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else if (result) {
            const signedUrl = this.getSignedRawUrl(result.public_id);
            resolve({
              url: signedUrl,
              publicId: result.public_id,
              secureUrl: signedUrl,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        },
      );

      const readable = Readable.from(buffer);
      readable.pipe(uploadStream);
    });
  }

  async uploadPdfStream(
    stream: Readable,
    publicId: string,
    folder: string = 'certificates',
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          public_id: publicId,
          folder,
          overwrite: true,
          format: 'pdf',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to upload PDF: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else if (result) {
            const signedUrl = this.getSignedRawUrl(result.public_id);
            resolve({
              url: signedUrl,
              publicId: result.public_id,
              secureUrl: signedUrl,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        },
      );

      stream.pipe(uploadStream);
    });
  }

  async deletePdf(publicId: string): Promise<boolean> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
      })) as { result: string };
      return result.result === 'ok';
    } catch (error) {
      this.logger.error(`Failed to delete PDF ${publicId}: ${error}`);
      return false;
    }
  }

  getCertificatePath(
    eventTitle: string,
    participantId: string,
    eventYear?: number,
  ): string {
    const year = Number.isInteger(eventYear)
      ? (eventYear as number)
      : new Date().getFullYear();
    const safeEventTitle = this.sanitizePathSegment(eventTitle);
    return `${year}/${safeEventTitle}/${participantId}`;
  }

  async uploadImageBuffer(
    buffer: Buffer,
    publicId: string,
    folder: string = '',
  ): Promise<ImageUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          type: 'authenticated',
          public_id: publicId,
          ...(folder ? { folder } : {}),
          overwrite: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to upload image: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else if (result) {
            const signedUrl = this.getSignedImageUrl(result.public_id);
            resolve({
              url: signedUrl,
              publicId: result.public_id,
              secureUrl: signedUrl,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        },
      );

      const readable = Readable.from(buffer);
      readable.pipe(uploadStream);
    });
  }

  getEditorImagePath(
    scope: 'blogs' | 'projects',
    createdAt: Date = new Date(),
  ): string {
    const year = createdAt.getFullYear();
    return `${scope}/${year}/${randomUUID()}`;
  }

  getSignedImageUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      secure: true,
      sign_url: true,
    });
  }

  getSignedRawUrl(publicId: string, format: string = 'pdf'): string {
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      secure: true,
      sign_url: true,
      format,
    });
  }

  private sanitizePathSegment(value: string): string {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);

    return sanitized || 'resource';
  }
}
