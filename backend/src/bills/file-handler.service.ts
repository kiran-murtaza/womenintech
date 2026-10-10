import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FileInput } from './interfaces/bill.interfaces';

@Injectable()
export class FileHandlerService {
  private readonly logger = new Logger(FileHandlerService.name);

  /**
   * Reads a single file from disk and returns a FileInput object.
   * Supports PDF, JPEG, PNG, and WEBP files.
   */
  readFileFromDisk(filePath: string): FileInput {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const buffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const mimeType = this.getMimeType(ext);
    const originalName = path.basename(absolutePath);

    this.logger.log(`Read file: ${originalName} (${mimeType}, ${buffer.length} bytes)`);

    return { buffer, mimeType, originalName };
  }

  /**
   * Reads all supported files from a directory.
   */
  readFilesFromDirectory(dirPath: string): FileInput[] {
    const absoluteDir = path.resolve(dirPath);

    if (!fs.existsSync(absoluteDir)) {
      throw new Error(`Directory not found: ${absoluteDir}`);
    }

    const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const files = fs.readdirSync(absoluteDir).filter((file) =>
      supportedExtensions.includes(path.extname(file).toLowerCase()),
    );

    if (files.length === 0) {
      this.logger.warn(`No supported files found in: ${absoluteDir}`);
      return [];
    }

    this.logger.log(`Found ${files.length} file(s) in ${absoluteDir}`);

    return files.map((file) =>
      this.readFileFromDisk(path.join(absoluteDir, file)),
    );
  }

  /**
   * Wraps an incoming upload buffer into a FileInput.
   */
  fromUploadBuffer(
    buffer: Buffer,
    originalName: string,
  ): FileInput {
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = this.getMimeType(ext);
    return { buffer, mimeType, originalName };
  }

  /**
   * Converts a buffer to a base64 string for Gemini API submission.
   */
  toBase64(buffer: Buffer): string {
    return this.stripDataUrlPrefix(buffer.toString('base64'));
  }

  stripDataUrlPrefix(base64Data: string): string {
    return base64Data.replace(/^data:(.*);base64,/, '');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getMimeType(
    ext: string,
  ): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' {
    const map: Record<
      string,
      'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
    > = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const mime = map[ext];
    if (!mime) {
      throw new Error(
        `Unsupported file type: ${ext}. Supported: .pdf, .jpg, .jpeg, .png, .webp`,
      );
    }
    return mime;
  }
}
