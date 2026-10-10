import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { FileHandlerService } from "./file-handler.service";
import {
  Level1BillData,
  Level2Answer,
  Level2QAResult,
} from "./interfaces/bill.interfaces";

// The 12 standard competition questions
const LEVEL2_QUESTIONS: string[] = [
  "What is the account holder name or customer name on the bill?",
  "What is the service address or property address associated with this bill?",
  "What is the billing date or invoice date of this bill?",
  "What is the due date for payment on this bill?",
  "What is the total amount due or payable on this bill?",
  "What is the energy consumption recorded in this bill (in kWh, kVAh, or relevant unit)?",
  "What tariff category or tariff type is applied to this account?",
  "What are the fixed charges or demand charges on this bill?",
  "What is the tax or VAT amount applied on this bill?",
  "What is the previous balance or outstanding amount carried forward?",
  "What is the meter number or meter ID mentioned in this bill?",
  "What is the sanctioned load or contract demand listed on this bill?",
];

@Injectable()
export class GeminiExtractorService {
  private readonly logger = new Logger(GeminiExtractorService.name);
  private readonly genai: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly fileHandler: FileHandlerService) {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    console.log(`[Gemini Engine] API Key Loaded: ${apiKey ? "YES" : "NO"}`);
    if (!apiKey) {
      throw new Error(
        "Missing Gemini API key. Set GEMINI_API_KEY in backend/.env.",
      );
    }
    this.genai = new GoogleGenAI({ apiKey });
    this.model =
      process.env.GEMINI_MODEL ||
      process.env.MODEL_NAME ||
      "gemini-3.1-flash-lite";
  }

  // ─── Level 1: Structured extraction ────────────────────────────────────────

  async extractLevel1Data(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<Level1BillData> {
    this.logger.log(`Running Level 1 extraction using model: ${this.model}`);

    const base64Data = this.fileHandler.stripDataUrlPrefix(
      this.fileHandler.toBase64(fileBuffer),
    );

    const prompt = `You are a utility bill data extraction expert.
Analyze the provided utility bill document and extract structured data.

IMPORTANT: Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Required JSON schema:
{
  "bill_id": "string or null",
  "account_number": "string or null",
  "billing_period": {
    "start": "YYYY-MM-DD or null",
    "end": "YYYY-MM-DD or null"
  },
  "total_amount_due": number or null,
  "tax_amount": number or null,
  "tariff_code": "string or null",
  "meter_readings": [
    {
      "meter_id": "string",
      "previous_reading": number or null,
      "current_reading": number or null,
      "unit": "string (e.g. kWh, kVAh)",
      "consumption": number or null
    }
  ]
}

Rules:
- Use null for any field that cannot be found.
- meter_readings must be an array (empty array [] if no meter data found).
- Dates must be in YYYY-MM-DD format.
- Amounts must be numeric values only (no currency symbols).
- Extract tariff_code as the rate/plan code printed on the bill.`;

    const response = await this.generateContent(
      {
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
      },
      "Level 1 bill extraction",
    );

    const rawText = response.text?.trim() ?? "";
    return this.parseJsonResponse<Level1BillData>(rawText, "Level1");
  }

  // ─── Level 2: Q&A answering ─────────────────────────────────────────────────

  async answerLevel2Questions(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<Level2QAResult> {
    this.logger.log(`Running Level 2 Q&A using model: ${this.model}`);

    const base64Data = this.fileHandler.stripDataUrlPrefix(
      this.fileHandler.toBase64(fileBuffer),
    );

    const questionsBlock = LEVEL2_QUESTIONS.map(
      (q, i) => `Q${i + 1}: ${q}`,
    ).join("\n");

    const prompt = `You are a utility bill analysis expert.
Read the provided utility bill document and answer each question strictly based on the bill content only.

Questions:
${questionsBlock}

IMPORTANT: Return ONLY a valid JSON array — no markdown, no code fences, no explanation.

Required JSON schema:
[
  {
    "question_number": 1,
    "question": "exact question text",
    "answer": "your answer based strictly on the bill, or 'Not found' if unavailable",
    "confidence": "high | medium | low | not_found"
  },
  ...
]

Rules:
- Answer ALL 12 questions in order.
- Base answers ONLY on content visible in the bill. Do not invent or assume values.
- Use "Not found" as the answer if information is not present, and set confidence to "not_found".
- Confidence levels: "high" = clearly stated, "medium" = inferred, "low" = unclear, "not_found" = absent.`;

    const response = await this.generateContent(
      {
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
      },
      "Bill questions",
    );

    const rawText = response.text?.trim() ?? "";
    const answers = this.parseJsonResponse<Level2Answer[]>(rawText, "Level2");

    return {
      bill_id: null, // will be populated by caller from Level 1 data
      answers,
    };
  }

  async *answerCustomQuestion(
    fileBuffer: Buffer,
    mimeType: string,
    question: string,
  ): AsyncGenerator<string> {
    const base64Data = this.fileHandler.stripDataUrlPrefix(
      this.fileHandler.toBase64(fileBuffer),
    );
    const prompt = `You are Hisaab, a helpful utility bill assistant. Answer the user's question using only the attached bill. If the bill does not contain the answer, say so clearly. Keep the answer concise and consumer-friendly.\n\nUser question: ${question}`;

    const answer = await this.retryGoogleCall(async () => {
      const response = await this.genai.models.generateContentStream({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: prompt },
            ],
          },
        ],
      });
      let text = "";
      for await (const chunk of response) {
        if (chunk.text) text += chunk.text;
      }
      return text;
    }, "Custom bill question");

    if (answer) yield answer;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async generateContent(
    params: Parameters<typeof this.genai.models.generateContent>[0],
    context: string,
  ) {
    return this.retryGoogleCall(
      () => this.genai.models.generateContent(params),
      context,
    );
  }

  private async retryGoogleCall<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!this.isRetryableGoogleError(error) || retry >= 3) {
          this.throwGoogleError(error, context);
        }

        const delayMs = 2000 * 2 ** retry;
        this.logger.warn(
          `${context} failed temporarily; retrying in ${delayMs / 1000}s (retry ${retry + 1}/3).`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private isRetryableGoogleError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const candidate = error as {
      status?: unknown;
      code?: unknown;
      name?: unknown;
      message?: unknown;
      error?: { status?: unknown; code?: unknown };
    };
    const status = candidate.status ?? candidate.error?.status;
    const code = candidate.code ?? candidate.error?.code;
    if (
      [429, 503, 504].includes(Number(status)) ||
      [429, 503, 504].includes(Number(code))
    ) {
      return true;
    }

    const name = typeof candidate.name === "string" ? candidate.name : "";
    const message =
      typeof candidate.message === "string" ? candidate.message : "";
    const networkCode = typeof code === "string" ? code : "";
    return (
      /AbortError|TimeoutError/i.test(name) ||
      /ETIMEDOUT|ECONNRESET|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT/i.test(
        networkCode,
      ) ||
      /timed?\s*out|timeout|socket hang up|network error|fetch failed/i.test(
        message,
      )
    );
  }

  private throwGoogleError(error: unknown, context: string): never {
    const errorStack =
      error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[Gemini Engine] ${context} failed:`, errorStack);

    const details =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    const statusMessage =
      typeof status === "number" || typeof status === "string"
        ? ` (HTTP ${status})`
        : "";

    throw new BadGatewayException(
      `Google AI Studio request failed${statusMessage}: ${details || "Unknown API error"}`,
    );
  }

  private parseJsonResponse<T>(raw: string, context: string): T {
    // Strip markdown code fences if model returns them despite instructions
    let cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      this.logger.error(
        `[${context}] Failed to parse JSON response. Raw:\n${raw}`,
      );
      throw new Error(
        `[${context}] Gemini returned invalid JSON. Raw response: ${raw.substring(0, 200)}`,
      );
    }
  }
}
