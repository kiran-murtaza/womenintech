// ─────────────────────────────────────────────
// Level 1: Structured bill extraction schema
// ─────────────────────────────────────────────
export interface MeterReading {
  meter_id: string;
  previous_reading: number | null;
  current_reading: number | null;
  unit: string;
  consumption: number | null;
}

export interface Level1BillData {
  bill_id: string | null;
  account_number: string | null;
  billing_period: {
    start: string | null; // ISO date string e.g. "2024-01-01"
    end: string | null;
  };
  total_amount_due: number | null;
  tax_amount: number | null;
  tariff_code: string | null;
  meter_readings: MeterReading[];
}

// ─────────────────────────────────────────────
// Level 2: Q&A answer schema
// ─────────────────────────────────────────────
export interface Level2Answer {
  question_number: number;
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low' | 'not_found';
}

export interface Level2QAResult {
  bill_id: string | null;
  answers: Level2Answer[];
}

// ─────────────────────────────────────────────
// CSV row structures
// ─────────────────────────────────────────────
export interface Level1CsvRow {
  bill_id: string;
  account_number: string;
  billing_start: string;
  billing_end: string;
  total_amount_due: string;
  tax_amount: string;
  tariff_code: string;
  meter_ids: string;         // comma-joined
  consumptions: string;      // comma-joined
  units: string;             // comma-joined
}

export interface Level2CsvRow {
  bill_id: string;
  question_number: string;
  question: string;
  answer: string;
  confidence: string;
}

// ─────────────────────────────────────────────
// File handler types
// ─────────────────────────────────────────────
export interface FileInput {
  buffer: Buffer;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  originalName: string;
}
