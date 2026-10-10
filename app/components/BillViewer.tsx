"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import {
  Bot,
  ChevronDown,
  FileText,
  RotateCcw,
  Send,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type MeterReading = {
  meter_id: string;
  previous_reading: number | null;
  current_reading: number | null;
  unit: string;
  consumption: number | null;
};

type BillAnswer = {
  question_number: number;
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low" | "not_found";
};

type BillViewerProps = {
  file: File;
  documentUrl: string;
  language?: "en" | "ur";
  level1: {
    account_number: string | null;
    billing_period: {
      start: string | null;
      end: string | null;
    };
    total_amount_due: number | null;
    tax_amount: number | null;
    meter_readings: MeterReading[];
  };
  level2: {
    answers: BillAnswer[];
  };
};

const faqQuestions = [
  { en: "Who is this bill for?", ur: "یہ بل کس کے نام پر ہے؟" },
  { en: "Where is the service address?", ur: "سروس کا پتہ کیا ہے؟" },
  { en: "When was this bill issued?", ur: "یہ بل کب جاری ہوا؟" },
  { en: "When is payment due?", ur: "ادائیگی کی آخری تاریخ کیا ہے؟" },
  { en: "What is the total amount payable?", ur: "کل کتنی رقم ادا کرنی ہے؟" },
  { en: "How much energy was used?", ur: "کتنی توانائی استعمال ہوئی؟" },
  { en: "What is the tariff rate?", ur: "ٹیرف کی شرح کیا ہے؟" },
  {
    en: "Are there fixed or demand charges?",
    ur: "کیا مقررہ یا ڈیمانڈ چارجز ہیں؟",
  },
  { en: "How much tax was charged?", ur: "کتنا ٹیکس لگایا گیا ہے؟" },
  { en: "Is there a previous balance?", ur: "کیا پچھلا بقایا موجود ہے؟" },
  {
    en: "Which meter was used for this bill?",
    ur: "اس بل کے لیے کون سا میٹر استعمال ہوا؟",
  },
  {
    en: "What is the sanctioned load or contract demand?",
    ur: "منظور شدہ لوڈ یا کنٹریکٹ ڈیمانڈ کیا ہے؟",
  },
];

const copy = {
  en: {
    document: "Your bill",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    reset: "Reset view",
    detailsTab: "Bill Details / بل کی تفصیلات",
    insightsTab: "Smart Insights / بل کے بارے میں",
    customer: "Customer Name",
    account: "Account Number",
    period: "Billing Month",
    meter: "Meter Reading",
    tax: "Tax Amount",
    total: "Total Amount Payable",
    notFound: "Not found on this bill",
    noDocument: "This document cannot be previewed in your browser.",
    noAnswers: "No bill answers are available yet.",
    askTitle: "Ask Hisaab AI",
    askDescription: "Ask a question about this bill.",
    askPlaceholder: "e.g. When is my payment due?",
    send: "Ask",
    thinking: "Reading your bill...",
    chatError: "We couldn't answer that question.",
  },
  ur: {
    document: "آپ کا بل",
    zoomOut: "چھوٹا کریں",
    zoomIn: "بڑا کریں",
    reset: "دوبارہ سیٹ کریں",
    detailsTab: "Bill Details / بل کی تفصیلات",
    insightsTab: "Smart Insights / بل کے بارے میں",
    customer: "صارف کا نام",
    account: "اکاؤنٹ نمبر",
    period: "بل کا مہینہ",
    meter: "میٹر ریڈنگ",
    tax: "ٹیکس کی رقم",
    total: "کل قابلِ ادائیگی رقم",
    notFound: "اس بل میں درج نہیں",
    noDocument: "یہ دستاویز براؤزر میں نہیں دیکھی جا سکتی۔",
    noAnswers: "بل کے جوابات ابھی دستیاب نہیں ہیں۔",
    askTitle: "حساب AI سے پوچھیں",
    askDescription: "اس بل کے بارے میں سوال پوچھیں۔",
    askPlaceholder: "مثال: ادائیگی کی آخری تاریخ کیا ہے؟",
    send: "پوچھیں",
    thinking: "آپ کا بل پڑھا جا رہا ہے...",
    chatError: "اس سوال کا جواب نہیں مل سکا۔",
  },
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

const TEMPORARY_CHAT_ERROR =
  "The AI server is temporarily busy. Please wait a moment and try again.";

function getSafeChatError(value: unknown, status?: number): string {
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return TEMPORARY_CHAT_ERROR;
  }

  let message: unknown = value instanceof Error ? value.message : value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof message === "string") {
      const trimmed = message.trim();
      if (!trimmed) return TEMPORARY_CHAT_ERROR;
      if (/\{\s*["'](?:error|code|message|status)["']\s*:/.test(trimmed)) {
        return TEMPORARY_CHAT_ERROR;
      }
      if (/^[\[{]/.test(trimmed)) {
        try {
          message = JSON.parse(trimmed) as unknown;
          continue;
        } catch {
          return TEMPORARY_CHAT_ERROR;
        }
      }
      return trimmed;
    }

    if (message && typeof message === "object" && "message" in message) {
      message = message.message;
      continue;
    }
    return TEMPORARY_CHAT_ERROR;
  }

  return TEMPORARY_CHAT_ERROR;
}

function formatPkr(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `₨ ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatBillingMonth(start: string | null, end: string | null) {
  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat("en", {
          month: "long",
          year: "numeric",
        }).format(date);
  };

  const firstMonth = formatDate(start);
  const lastMonth = formatDate(end);
  if (!firstMonth) return lastMonth;
  if (!lastMonth || firstMonth === lastMonth) return firstMonth;
  return `${firstMonth} – ${lastMonth}`;
}

export default function BillViewer({
  file,
  documentUrl,
  language = "en",
  level1,
  level2,
}: BillViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"details" | "insights">("details");
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [chatError, setChatError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const t = copy[language];
  const isImage =
    file.type.startsWith("image/") || /\.(?:jpe?g|png|webp)$/i.test(file.name);

  const setZoomWithinBounds = (amount: number) => {
    setZoom((current) => Math.min(2.5, Math.max(0.75, current + amount)));
  };

  const resetView = () => {
    setZoom(1);
    if (documentContainerRef.current) {
      documentContainerRef.current.scrollTo({ top: 0, left: 0 });
    }
  };

  const customerName = level2.answers.find(
    (answer) => answer.question_number === 1,
  )?.answer;
  const meterReading = level1.meter_readings
    .map((reading) => {
      const current =
        reading.current_reading == null
          ? null
          : `${reading.current_reading} ${reading.unit}`;
      const consumption =
        reading.consumption == null
          ? null
          : `${reading.consumption} ${reading.unit} used`;
      return [reading.meter_id, current, consumption]
        .filter(Boolean)
        .join(" · ");
    })
    .filter(Boolean)
    .join("\n");
  const details = [
    [t.customer, customerName],
    [t.account, level1.account_number],
    [
      t.period,
      formatBillingMonth(
        level1.billing_period?.start,
        level1.billing_period?.end,
      ),
    ],
    [t.meter, meterReading],
    [t.tax, formatPkr(level1.tax_amount)],
    [t.total, formatPkr(level1.total_amount_due)],
  ];

  const handleAskHisaabAI = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatQuestion.trim();
    if (!question || isAsking) return;

    setChatError("");
    setChatQuestion("");
    setIsAsking(true);
    const assistantIndex = chatMessages.length + 1;
    setChatMessages((messages) => [
      ...messages,
      { role: "user", text: question },
      { role: "assistant", text: "" },
    ]);

    try {
      const formData = new FormData();
      formData.append("bill", file);
      formData.append("question", question);
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(getSafeChatError(responseText, response.status));
      }
      if (!response.body) throw new Error(TEMPORARY_CHAT_ERROR);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let streamedAnswer = "";
      const handleFrame = (frame: string) => {
        const lines = frame.split(/\r?\n/);
        const eventType = lines
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) return;

        let payload: unknown;
        try {
          payload = JSON.parse(data) as unknown;
        } catch {
          throw new Error(TEMPORARY_CHAT_ERROR);
        }
        if (eventType === "error") {
          throw new Error(getSafeChatError(payload));
        }
        if (
          !payload ||
          typeof payload !== "object" ||
          !("text" in payload) ||
          typeof payload.text !== "string"
        ) {
          return;
        }

        streamedAnswer += payload.text;
        setChatMessages((messages) =>
          messages.map((message, index) =>
            index === assistantIndex
              ? { ...message, text: streamedAnswer }
              : message,
          ),
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const frames = pending.split(/\r?\n\r?\n/);
        pending = frames.pop() || "";
        frames.forEach(handleFrame);
        if (done) {
          if (pending.trim()) handleFrame(pending);
          break;
        }
      }
    } catch (error) {
      setChatMessages((messages) =>
        messages.filter(
          (message, index) => index !== assistantIndex || Boolean(message.text),
        ),
      );
      setChatError(getSafeChatError(error));
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid min-h-[620px] lg:grid-cols-2">
        <div className="flex min-h-[420px] flex-col border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950 lg:border-b-0 lg:border-e">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="truncate text-sm font-semibold">{t.document}</h2>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomWithinBounds(-0.25)}
                disabled={zoom <= 0.75}
                aria-label={t.zoomOut}
                title={t.zoomOut}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ZoomOut size={18} />
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomWithinBounds(0.25)}
                disabled={zoom >= 2.5}
                aria-label={t.zoomIn}
                title={t.zoomIn}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={resetView}
                aria-label={t.reset}
                title={t.reset}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </div>

          <div
            ref={documentContainerRef}
            className="flex flex-1 items-start justify-center overflow-auto p-4 sm:p-6"
          >
            {documentUrl ? (
              <div
                className="relative flex min-h-[520px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md transition-[width,height] duration-200"
                style={{
                  width: `${Math.max(100, zoom * 100)}%`,
                  height: `${Math.max(520, 700 * zoom)}px`,
                }}
              >
                {isImage ? (
                  <Image
                    src={documentUrl}
                    alt={file.name}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                  />
                ) : (
                  <iframe
                    src={documentUrl}
                    title={file.name}
                    className="h-full w-full border-0"
                  />
                )}
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
                <FileText size={32} aria-hidden="true" />
                <span>{t.noDocument}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col">
          <div
            role="tablist"
            aria-label="Bill information"
            className="flex border-b border-slate-200 dark:border-slate-800"
          >
            <button
              type="button"
              role="tab"
              id="bill-details-tab"
              aria-selected={activeTab === "details"}
              aria-controls="bill-details-panel"
              onClick={() => setActiveTab("details")}
              className={`flex-1 border-b-2 px-3 py-4 text-sm font-semibold transition sm:px-5 ${
                activeTab === "details"
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t.detailsTab}
            </button>
            <button
              type="button"
              role="tab"
              id="bill-insights-tab"
              aria-selected={activeTab === "insights"}
              aria-controls="bill-insights-panel"
              onClick={() => setActiveTab("insights")}
              className={`flex-1 border-b-2 px-3 py-4 text-sm font-semibold transition sm:px-5 ${
                activeTab === "insights"
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t.insightsTab}
            </button>
          </div>

          {activeTab === "details" ? (
            <div
              id="bill-details-panel"
              role="tabpanel"
              aria-labelledby="bill-details-tab"
              className="flex-1 p-5 sm:p-7"
            >
              <h3 className="mb-5 text-base font-semibold">
                {language === "en" ? "At a glance" : "ایک نظر میں"}
              </h3>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                {details.map(([label, value], index) => (
                  <div
                    key={label}
                    className={`flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5 ${
                      index === details.length - 1
                        ? "rounded-xl bg-emerald-50 px-4 dark:bg-emerald-950/35"
                        : ""
                    }`}
                  >
                    <dt className="text-sm text-slate-500 dark:text-slate-400">
                      {label}
                    </dt>
                    <dd
                      className={`whitespace-pre-line text-sm font-medium sm:max-w-[60%] sm:text-end ${
                        index === details.length - 1
                          ? "text-lg font-bold text-emerald-800 dark:text-emerald-300"
                          : ""
                      }`}
                    >
                      {value || t.notFound}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div
              id="bill-insights-panel"
              role="tabpanel"
              aria-labelledby="bill-insights-tab"
              className="flex-1 p-4 sm:p-6"
            >
              <h3 className="mb-4 px-1 text-base font-semibold">
                {language === "en"
                  ? "Answers about your bill"
                  : "آپ کے بل کے بارے میں جوابات"}
              </h3>
              {level2.answers.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {t.noAnswers}
                </p>
              ) : (
                <div className="max-h-[560px] space-y-2 overflow-y-auto pe-1">
                  {faqQuestions.map((question, index) => {
                    const answer = level2.answers.find(
                      (item) => item.question_number === index + 1,
                    );
                    const isOpen = openQuestion === index;
                    return (
                      <article
                        key={question.en}
                        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenQuestion(isOpen ? null : index)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-start text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                        >
                          <span>
                            {language === "en" ? question.en : question.ur}
                          </span>
                          <ChevronDown
                            size={17}
                            className={`shrink-0 text-slate-400 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                        {isOpen && (
                          <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                            {answer?.answer || t.notFound}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Bot
                    size={18}
                    className="text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  {t.askTitle}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.askDescription}
                </p>
                {chatMessages.length > 0 && (
                  <div
                    className="mt-4 max-h-64 space-y-3 overflow-y-auto"
                    aria-live="polite"
                  >
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "ms-auto bg-emerald-600 text-white"
                            : "me-auto bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {message.text ||
                          (isAsking && index === chatMessages.length - 1
                            ? t.thinking
                            : "")}
                      </div>
                    ))}
                  </div>
                )}
                {chatError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    {chatError}
                  </p>
                )}
                <form
                  onSubmit={handleAskHisaabAI}
                  className="mt-4 flex items-center gap-2"
                >
                  <input
                    value={chatQuestion}
                    onChange={(event) => setChatQuestion(event.target.value)}
                    placeholder={t.askPlaceholder}
                    aria-label={t.askTitle}
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !chatQuestion.trim()}
                    aria-label={t.send}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
