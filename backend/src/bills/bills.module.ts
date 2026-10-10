import { Module } from "@nestjs/common";
import { AskController, BillsController } from "./bills.controller";
import { BillsService } from "./bills.service";
import { FileHandlerService } from "./file-handler.service";
import { GeminiExtractorService } from "./gemini-extractor.service";
import { CsvExporterService } from "./csv-exporter.service";

@Module({
  controllers: [BillsController, AskController],
  providers: [
    BillsService,
    FileHandlerService,
    GeminiExtractorService,
    CsvExporterService,
  ],
  exports: [BillsService],
})
export class BillsModule {}
