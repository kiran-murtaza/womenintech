import { Test, TestingModule } from '@nestjs/testing';
import { BillsService } from './bills.service';
import { FileHandlerService } from './file-handler.service';
import { GeminiExtractorService } from './gemini-extractor.service';
import { CsvExporterService } from './csv-exporter.service';
import * as path from 'path';

// ─── Mock services ────────────────────────────────────────────────────────────

const mockLevel1: any = {
  bill_id: 'TEST-001',
  account_number: 'ACC-12345',
  billing_period: { start: '2024-01-01', end: '2024-01-31' },
  total_amount_due: 1500.75,
  tax_amount: 150.00,
  tariff_code: 'LT-II',
  meter_readings: [
    {
      meter_id: 'MTR-001',
      previous_reading: 1000,
      current_reading: 1200,
      unit: 'kWh',
      consumption: 200,
    },
  ],
};

const mockLevel2: any = {
  bill_id: 'TEST-001',
  answers: [
    { question_number: 1, question: 'Account holder name?', answer: 'Jane Doe', confidence: 'high' },
    { question_number: 2, question: 'Service address?', answer: '123 Main St', confidence: 'high' },
  ],
};

describe('BillsService', () => {
  let service: BillsService;
  let geminiExtractor: jest.Mocked<GeminiExtractorService>;
  let csvExporter: jest.Mocked<CsvExporterService>;
  let fileHandler: jest.Mocked<FileHandlerService>;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        BillsService,
        {
          provide: FileHandlerService,
          useValue: {
            readFileFromDisk: jest.fn().mockReturnValue({
              buffer: Buffer.from('fake-pdf'),
              mimeType: 'application/pdf',
              originalName: 'test.pdf',
            }),
            fromUploadBuffer: jest.fn().mockReturnValue({
              buffer: Buffer.from('fake-pdf'),
              mimeType: 'application/pdf',
              originalName: 'test.pdf',
            }),
            readFilesFromDirectory: jest.fn().mockReturnValue([
              {
                buffer: Buffer.from('fake-pdf'),
                mimeType: 'application/pdf',
                originalName: 'test.pdf',
              },
            ]),
            toBase64: jest.fn().mockReturnValue('base64string'),
          },
        },
        {
          provide: GeminiExtractorService,
          useValue: {
            extractLevel1Data: jest.fn().mockResolvedValue(mockLevel1),
            answerLevel2Questions: jest.fn().mockResolvedValue({ ...mockLevel2, bill_id: null }),
          },
        },
        {
          provide: CsvExporterService,
          useValue: {
            writeLevel1: jest.fn().mockResolvedValue(undefined),
            writeLevel2: jest.fn().mockResolvedValue(undefined),
            readMonthlyReport: jest.fn().mockResolvedValue([
              { filename: 'level1.csv', content: 'Bill ID\nTEST-001\n' },
              { filename: 'level2.csv', content: 'Bill ID,Question #\nTEST-001,1\n' },
            ]),
          },
        },
      ],
    }).compile();

    service = testingModule.get<BillsService>(BillsService);
    geminiExtractor = testingModule.get(GeminiExtractorService);
    csvExporter = testingModule.get(CsvExporterService);
    fileHandler = testingModule.get(FileHandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processFileFromDisk', () => {
    it('should call extractLevel1Data and answerLevel2Questions', async () => {
      const result = await service.processFileFromDisk('/fake/path/bill.pdf');

      expect(fileHandler.readFileFromDisk).toHaveBeenCalledWith('/fake/path/bill.pdf');
      expect(geminiExtractor.extractLevel1Data).toHaveBeenCalled();
      expect(geminiExtractor.answerLevel2Questions).toHaveBeenCalled();
      expect(result.level1.bill_id).toBe('TEST-001');
      expect(result.level2.bill_id).toBe('TEST-001'); // should be set from level1
    });

    it('should write both CSVs', async () => {
      await service.processFileFromDisk('/fake/path/bill.pdf');

      expect(csvExporter.writeLevel1).toHaveBeenCalledWith(mockLevel1);
      expect(csvExporter.writeLevel2).toHaveBeenCalled();
    });
  });

  describe('processFileFromBuffer', () => {
    it('should process upload buffer successfully', async () => {
      const buffer = Buffer.from('pdf-data');
      const result = await service.processFileFromBuffer(buffer, 'upload.pdf');

      expect(fileHandler.fromUploadBuffer).toHaveBeenCalledWith(buffer, 'upload.pdf');
      expect(result.level1).toBeDefined();
      expect(result.level2).toBeDefined();
    });
  });

  describe('getMonthlyReport', () => {
    it('should return both generated CSV reports', async () => {
      const reports = await service.getMonthlyReport();

      expect(csvExporter.readMonthlyReport).toHaveBeenCalled();
      expect(reports.map((report) => report.filename)).toEqual([
        'level1.csv',
        'level2.csv',
      ]);
    });
  });
});
