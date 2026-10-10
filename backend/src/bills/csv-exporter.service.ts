import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import {
  Level1BillData,
  Level2QAResult,
  Level1CsvRow,
  Level2CsvRow,
} from './interfaces/bill.interfaces';

@Injectable()
export class CsvExporterService {
  private readonly logger = new Logger(CsvExporterService.name);
  private readonly outputDir: string;

  constructor() {
    this.outputDir = path.resolve(__dirname, '../../../output');
    this.ensureOutputDir();
  }

  async readMonthlyReport(): Promise<
    Array<{ filename: string; content: string }>
  > {
    const filenames = ['level1.csv', 'level2.csv'];
    const missingFiles = filenames.filter(
      (filename) => !fs.existsSync(path.join(this.outputDir, filename)),
    );

    if (missingFiles.length > 0) {
      throw new NotFoundException('Scan at least one bill before downloading a report.');
    }

    return Promise.all(
      filenames.map(async (filename) => ({
        filename,
        content: await fs.promises.readFile(
          path.join(this.outputDir, filename),
          'utf8',
        ),
      })),
    );
  }

  // ─── Level 1 CSV export ──────────────────────────────────────────────────

  async writeLevel1(data: Level1BillData): Promise<void> {
    const csvPath = path.join(this.outputDir, 'level1.csv');
    const fileExists = fs.existsSync(csvPath);

    const writer = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'bill_id', title: 'Bill ID' },
        { id: 'account_number', title: 'Account Number' },
        { id: 'billing_start', title: 'Billing Start' },
        { id: 'billing_end', title: 'Billing End' },
        { id: 'total_amount_due', title: 'Total Amount Due' },
        { id: 'tax_amount', title: 'Tax Amount' },
        { id: 'tariff_code', title: 'Tariff Code' },
        { id: 'meter_ids', title: 'Meter IDs' },
        { id: 'consumptions', title: 'Consumptions' },
        { id: 'units', title: 'Units' },
      ],
      append: fileExists, // append if file already exists, else write fresh
    });

    const row: Level1CsvRow = {
      bill_id: data.bill_id ?? 'N/A',
      account_number: data.account_number ?? 'N/A',
      billing_start: data.billing_period?.start ?? 'N/A',
      billing_end: data.billing_period?.end ?? 'N/A',
      total_amount_due:
        data.total_amount_due != null ? String(data.total_amount_due) : 'N/A',
      tax_amount: data.tax_amount != null ? String(data.tax_amount) : 'N/A',
      tariff_code: data.tariff_code ?? 'N/A',
      meter_ids: data.meter_readings.map((m) => m.meter_id).join('; ') || 'N/A',
      consumptions:
        data.meter_readings.map((m) => m.consumption ?? 'N/A').join('; ') ||
        'N/A',
      units: data.meter_readings.map((m) => m.unit).join('; ') || 'N/A',
    };

    await writer.writeRecords([row]);
    this.logger.log(`Level 1 CSV written → ${csvPath} (append: ${fileExists})`);
  }

  // ─── Level 2 CSV export ──────────────────────────────────────────────────

  async writeLevel2(result: Level2QAResult): Promise<void> {
    const csvPath = path.join(this.outputDir, 'level2.csv');
    const fileExists = fs.existsSync(csvPath);

    const writer = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'bill_id', title: 'Bill ID' },
        { id: 'question_number', title: 'Question #' },
        { id: 'question', title: 'Question' },
        { id: 'answer', title: 'Answer' },
        { id: 'confidence', title: 'Confidence' },
      ],
      append: fileExists,
    });

    const rows: Level2CsvRow[] = result.answers.map((a) => ({
      bill_id: result.bill_id ?? 'N/A',
      question_number: String(a.question_number),
      question: a.question,
      answer: a.answer,
      confidence: a.confidence,
    }));

    await writer.writeRecords(rows);
    this.logger.log(`Level 2 CSV written → ${csvPath} (${rows.length} rows, append: ${fileExists})`);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      this.logger.log(`Created output directory: ${this.outputDir}`);
    }
  }
}
