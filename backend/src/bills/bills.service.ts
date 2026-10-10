import { Injectable, Logger } from '@nestjs/common';
import { FileHandlerService } from './file-handler.service';
import { GeminiExtractorService } from './gemini-extractor.service';
import { CsvExporterService } from './csv-exporter.service';
import { Level1BillData, Level2QAResult } from './interfaces/bill.interfaces';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private readonly fileHandler: FileHandlerService,
    private readonly geminiExtractor: GeminiExtractorService,
    private readonly csvExporter: CsvExporterService,
  ) {}

  /**
   * Process a single bill file from disk path.
   * Runs Level 1 extraction + Level 2 Q&A and exports both to CSV.
   */
  async processFileFromDisk(filePath: string): Promise<{
    level1: Level1BillData;
    level2: Level2QAResult;
  }> {
    this.logger.log(`Processing file: ${filePath}`);

    const fileInput = this.fileHandler.readFileFromDisk(filePath);
    return this.processBill(fileInput.buffer, fileInput.mimeType);
  }

  /**
   * Process a bill from an upload buffer (e.g., multipart form upload).
   */
  async processFileFromBuffer(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ level1: Level1BillData; level2: Level2QAResult }> {
    this.logger.log(`Processing uploaded file: ${originalName}`);

    const fileInput = this.fileHandler.fromUploadBuffer(buffer, originalName);
    return this.processBill(fileInput.buffer, fileInput.mimeType);
  }

  /**
   * Batch-process all supported files in a directory.
   */
  async processDirectory(dirPath: string): Promise<
    Array<{ file: string; level1: Level1BillData; level2: Level2QAResult }>
  > {
    const files = this.fileHandler.readFilesFromDirectory(dirPath);
    const results = [];

    for (const file of files) {
      this.logger.log(`Batch processing: ${file.originalName}`);
      const result = await this.processBill(file.buffer, file.mimeType);
      results.push({ file: file.originalName, ...result });
    }

    this.logger.log(`Batch complete. Processed ${results.length} file(s).`);
    return results;
  }

  async getMonthlyReport(): Promise<
    Array<{ filename: string; content: string }>
  > {
    return this.csvExporter.readMonthlyReport();
  }

  async *answerCustomQuestion(
    buffer: Buffer,
    originalName: string,
    question: string,
  ): AsyncGenerator<string> {
    const fileInput = this.fileHandler.fromUploadBuffer(buffer, originalName);
    yield* this.geminiExtractor.answerCustomQuestion(
      fileInput.buffer,
      fileInput.mimeType,
      question,
    );
  }

  // ─── Private core processing pipeline ───────────────────────────────────────

  private async processBill(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ level1: Level1BillData; level2: Level2QAResult }> {
    // Run Level 1 extraction
    const level1 = await this.geminiExtractor.extractLevel1Data(buffer, mimeType);

    // Run Level 2 Q&A
    const level2 = await this.geminiExtractor.answerLevel2Questions(buffer, mimeType);

    // Attach bill_id from Level 1 into Level 2 result for traceability
    level2.bill_id = level1.bill_id;

    // Export both results to CSV
    await this.csvExporter.writeLevel1(level1);
    await this.csvExporter.writeLevel2(level2);

    return { level1, level2 };
  }
}
