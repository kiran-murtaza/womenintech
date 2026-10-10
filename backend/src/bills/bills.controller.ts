import {
  Controller,
  Get,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  BadRequestException,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { BillsService } from "./bills.service";

const TEMPORARY_CHAT_ERROR =
  "The AI server is temporarily busy. Please wait a moment and try again.";

async function streamBillAnswer(
  billsService: BillsService,
  file: Express.Multer.File | undefined,
  question: string,
  response: Response,
): Promise<void> {
  if (!file) {
    throw new BadRequestException('Attach a bill using the "bill" file field.');
  }
  if (typeof question !== "string" || !question.trim()) {
    throw new BadRequestException("Enter a question about this bill.");
  }

  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  try {
    const answer = billsService.answerCustomQuestion(
      file.buffer,
      file.originalname,
      question.trim(),
    );
    for await (const text of answer) {
      response.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    response.end();
  } catch (error) {
    console.error("Google AI Studio Error:", error);
    response.write(
      `event: error\ndata: ${JSON.stringify({
        message: getSafeChatError(error),
      })}\n\n`,
    );
    response.end();
  }
}

function getSafeChatError(error: unknown): string {
  if (error instanceof HttpException) {
    if (
      error.getStatus() === HttpStatus.BAD_GATEWAY ||
      error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE ||
      error.getStatus() === HttpStatus.GATEWAY_TIMEOUT ||
      error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
    ) {
      return TEMPORARY_CHAT_ERROR;
    }
    const details = error.getResponse();
    if (typeof details === "string") {
      return isRawErrorJson(details) ? TEMPORARY_CHAT_ERROR : details;
    }
    if (details && typeof details === "object" && "message" in details) {
      const message = (details as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message
          .filter((item): item is string => typeof item === "string")
          .join(" ");
      }
      if (
        typeof message === "string" &&
        !isRawErrorJson(message)
      ) {
        return message;
      }
    }
  }
  return TEMPORARY_CHAT_ERROR;
}

function isRawErrorJson(value: string): boolean {
  return (
    /^\s*[\[{]/.test(value) ||
    /\{\s*["'](?:error|code|message|status)["']\s*:/.test(value)
  );
}

@Controller("bills")
export class BillsController {
  private readonly logger = new Logger(BillsController.name);

  constructor(private readonly billsService: BillsService) {}

  @Get("monthly-report")
  async getMonthlyReport() {
    const files = await this.billsService.getMonthlyReport();
    return {
      success: true,
      data: files,
    };
  }

  /**
   * POST /bills/process-file
   * Body: { "filePath": "/absolute/or/relative/path/to/bill.pdf" }
   * Processes a single file from disk.
   */
  @Post("process-file")
  @HttpCode(HttpStatus.OK)
  async processFile(@Body() body: { filePath: string }) {
    this.logger.log(`POST /bills/process-file → ${body.filePath}`);
    const result = await this.processWithGoogleErrorLogging(() =>
      this.billsService.processFileFromDisk(body.filePath),
    );
    return {
      success: true,
      message: "Bill processed successfully.",
      data: result,
    };
  }

  /**
   * POST /bills/process-directory
   * Body: { "dirPath": "/path/to/bills/folder" }
   * Batch processes all supported files in a directory.
   */
  @Post("process-directory")
  @HttpCode(HttpStatus.OK)
  async processDirectory(@Body() body: { dirPath: string }) {
    this.logger.log(`POST /bills/process-directory → ${body.dirPath}`);
    const results = await this.processWithGoogleErrorLogging(() =>
      this.billsService.processDirectory(body.dirPath),
    );
    return {
      success: true,
      message: `Processed ${results.length} file(s).`,
      data: results,
    };
  }

  /**
   * POST /bills/upload
   * Multipart form: file field = "bill"
   * Upload a bill file directly for processing.
   */
  @Post("upload")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("bill"))
  async uploadAndProcess(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return {
        success: false,
        message: 'No file uploaded. Use field name "bill".',
      };
    }

    this.logger.log(
      `POST /bills/upload → ${file.originalname} (${file.size} bytes)`,
    );
    const result = await this.processWithGoogleErrorLogging(() =>
      this.billsService.processFileFromBuffer(file.buffer, file.originalname),
    );

    return {
      success: true,
      message: `Bill "${file.originalname}" processed successfully.`,
      data: result,
    };
  }

  @Post("chat")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("bill"))
  async askAboutBill(
    @UploadedFile() file: Express.Multer.File,
    @Body("question") question: string,
    @Res() response: Response,
  ) {
    await streamBillAnswer(this.billsService, file, question, response);
  }

  private async processWithGoogleErrorLogging<T>(
    process: () => Promise<T>,
  ): Promise<T> {
    try {
      return await process();
    } catch (error) {
      console.error("Google AI Studio Error:", error);
      throw error;
    }
  }
}

@Controller()
export class AskController {
  constructor(private readonly billsService: BillsService) {}

  @Post("ask")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("bill"))
  async ask(
    @UploadedFile() file: Express.Multer.File,
    @Body("question") question: string,
    @Res() response: Response,
  ) {
    await streamBillAnswer(this.billsService, file, question, response);
  }
}
