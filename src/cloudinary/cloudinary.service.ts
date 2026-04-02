import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
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
        'Cloudinary credentials not fully configured. Certificate uploads will fail.',
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
            resolve({
              url: result.url,
              publicId: result.public_id,
              secureUrl: result.secure_url,
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
            resolve({
              url: result.url,
              publicId: result.public_id,
              secureUrl: result.secure_url,
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
      })) as { result: string };
      return result.result === 'ok';
    } catch (error) {
      this.logger.error(`Failed to delete PDF ${publicId}: ${error}`);
      return false;
    }
  }

  getCertificatePath(eventId: string, participantId: string): string {
    return `${eventId}/${participantId}`;
  }
}
