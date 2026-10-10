"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Moon,
  Sun,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import BillViewer from "./components/BillViewer";

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const ACCEPTED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

const translations = {
  en: {
    title: "My Bills",
    totalDues: "Total Dues",
    billsScanned: "Bills Scanned",
    highestBill: "Highest Bill",
    uploadTitle: "Add your bills",
    dropPrompt: "Drop your electric, gas, or water bills here, or click to upload",
    fileTypes: "PDF or images (JPG, PNG, WEBP)",
    selected: "Selected bills",
    scan: "Scan Bills",
    reading: "Reading document...",
    calculating: "Calculating totals...",
    complete: "Complete!",
    empty: "Your uploaded bills will appear here.",
    waiting: "Ready to scan",
    scanned: "Scanned",
    failed: "Could not scan",
    remove: "Remove",
    invalidFile: "Please choose PDF or image files (JPG, PNG, WEBP).",
    noFiles: "Add at least one bill to start scanning.",
    scanError: "Some bills could not be scanned. Check the file status and try again.",
    apiError: "The bill scanning service could not be reached. Please try again.",
    reportError: "The report is not available yet. Scan your bills and try again.",
  },
  ur: {
    title: "میرے بل",
    totalDues: "کل واجب الادا",
    billsScanned: "اسکین شدہ بل",
    highestBill: "سب سے زیادہ بل",
    uploadTitle: "اپنے بل شامل کریں",
    dropPrompt: "اپنے بجلی، گیس یا پانی کے بل یہاں ڈراپ کریں، یا اپ لوڈ کرنے کے لیے کلک کریں",
    fileTypes: "پی ڈی ایف یا تصاویر (JPG، PNG، WEBP)",
    selected: "منتخب بل",
    scan: "بل اسکین کریں",
    reading: "دستاویز پڑھی جا رہی ہے...",
    calculating: "کل رقم کا حساب ہو رہا ہے...",
    complete: "مکمل!",
    empty: "آپ کے اپ لوڈ کردہ بل یہاں نظر آئیں گے۔",
    waiting: "اسکین کے لیے تیار",
    scanned: "اسکین مکمل",
    failed: "اسکین نہیں ہو سکا",
    remove: "ہٹائیں",
    invalidFile: "براہ کرم پی ڈی ایف یا تصویر منتخب کریں (JPG، PNG، WEBP)۔",
    noFiles: "اسکین شروع کرنے کے لیے کم از کم ایک بل شامل کریں۔",
    scanError: "کچھ بل اسکین نہیں ہو سکے۔ فائل کی حالت دیکھیں اور دوبارہ کوشش کریں۔",
    apiError: "بل اسکین کرنے کی سروس سے رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    reportError: "رپورٹ ابھی دستیاب نہیں۔ پہلے اپنے بل اسکین کریں۔",
  },
};

function formatPkr(amount) {
  return `₨ ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function fileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function subscribeToTheme(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener("hisaab-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("hisaab-theme-change", onChange);
  };
}

function getThemeSnapshot() {
  return window.localStorage.getItem("hisaab-theme") === "dark";
}

function getThemeServerSnapshot() {
  return false;
}

async function readApiPayload(response, fallbackMessage) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${fallbackMessage} (HTTP ${response.status})`);
  }
}

function getApiErrorMessage(payload, fallbackMessage) {
  const message = Array.isArray(payload?.message)
    ? payload.message.join(" ")
    : payload?.message;
  return typeof message === "string" && message.trim()
    ? message
    : fallbackMessage;
}

export default function HisaabDashboard() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const [language, setLanguage] = useState("en");
  const [bills, setBills] = useState([]);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [activeBillId, setActiveBillId] = useState(null);
  const inputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const isScanning = stage === "reading" || stage === "calculating";
  const t = translations[language];
  const completedBills = bills.filter((bill) => bill.status === "complete");
  const activeBill = completedBills.find((bill) => bill.id === activeBillId);
  const totalDues = completedBills.reduce(
    (sum, bill) => sum + (Number(bill.result?.level1?.total_amount_due) || 0),
    0,
  );
  const highestBill = completedBills.reduce(
    (highest, bill) =>
      Math.max(highest, Number(bill.result?.level1?.total_amount_due) || 0),
    0,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeoutId = window.setTimeout(() => setToastMessage(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const addFiles = (fileList) => {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;

    const validFiles = selectedFiles.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return extension && ACCEPTED_EXTENSIONS.has(extension);
    });

    setErrorMessage(validFiles.length === selectedFiles.length ? "" : t.invalidFile);
    if (!validFiles.length) return;

    const existingIds = new Set(bills.map((bill) => bill.id));
    const additions = validFiles
      .filter((file) => !existingIds.has(fileId(file)))
      .map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return {
          id: fileId(file),
          file,
          previewUrl,
          status: "queued",
        };
      });
    setBills((existing) => [...existing, ...additions]);
    setStage("idle");
    setProgress(0);
  };

  const handleScan = async () => {
    const queuedBills = bills.filter((bill) => bill.status === "queued");
    if (!queuedBills.length || isScanning) {
      if (!queuedBills.length && !completedBills.length) setErrorMessage(t.noFiles);
      return;
    }

    setErrorMessage("");
    setStage("reading");
    let successfulScans = 0;
    let failedScans = 0;
    let firstScanError = "";

    for (let index = 0; index < queuedBills.length; index += 1) {
      const bill = queuedBills[index];
      setBills((current) =>
        current.map((item) =>
          item.id === bill.id ? { ...item, status: "scanning" } : item,
        ),
      );
      setProgress(Math.round((index / queuedBills.length) * 90));

      try {
        const formData = new FormData();
        formData.append("bill", bill.file);
        const response = await fetch(`${API_URL}/bills/upload`, {
          method: "POST",
          body: formData,
        });
        const payload = await readApiPayload(response, t.apiError);

        if (!response.ok || !payload.success || !payload.data?.level1) {
          throw new Error(
            getApiErrorMessage(
              payload,
              `${t.apiError} (HTTP ${response.status})`,
            ),
          );
        }

        setStage("calculating");
        setBills((current) =>
          current.map((item) =>
            item.id === bill.id
              ? { ...item, status: "complete", result: payload.data }
              : item,
          ),
        );
        setActiveBillId(bill.id);
        setToastMessage("Report Saved Successfully!");
        successfulScans += 1;
        setProgress(Math.round(((index + 0.9) / queuedBills.length) * 100));
      } catch (error) {
        const message = error instanceof Error ? error.message : t.apiError;
        firstScanError ||= message;
        setErrorMessage(message);
        setBills((current) =>
          current.map((item) =>
            item.id === bill.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
        failedScans += 1;
      }

      if (index < queuedBills.length - 1) setStage("reading");
    }

    setProgress(100);
    if (failedScans > 0) setErrorMessage(firstScanError || t.scanError);
    setStage(successfulScans > 0 && failedScans === 0 ? "complete" : "idle");
  };

  const handleDrop = (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const handleThemeToggle = () => {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    window.localStorage.setItem("hisaab-theme", nextIsDark ? "dark" : "light");
    window.dispatchEvent(new Event("hisaab-theme-change"));
  };

  const handleDownloadReport = async () => {
    if (isDownloadingReport || isScanning) return;
    setIsDownloadingReport(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_URL}/bills/monthly-report`);
      const payload = await readApiPayload(response, t.reportError);
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(
          getApiErrorMessage(
            payload,
            `${t.reportError} (HTTP ${response.status})`,
          ),
        );
      }

      const reportFiles = payload.data.filter(
        (file) =>
          ["level1.csv", "level2.csv"].includes(file.filename) &&
          typeof file.content === "string",
      );
      if (reportFiles.length !== 2) throw new Error(t.reportError);

      for (const file of reportFiles) {
        const url = URL.createObjectURL(
          new Blob([file.content], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setToastMessage("Report Saved Successfully!");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.reportError,
      );
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleRemove = (id) => {
    if (isScanning) return;
    const removedBill = bills.find((bill) => bill.id === id);
    if (removedBill?.previewUrl) {
      URL.revokeObjectURL(removedBill.previewUrl);
      previewUrlsRef.current.delete(removedBill.previewUrl);
    }
    setBills((current) => current.filter((bill) => bill.id !== id));
    setStage("idle");
    setProgress(0);
  };

  const scanLabel =
    stage === "reading"
      ? t.reading
      : stage === "calculating"
        ? t.calculating
        : stage === "complete"
          ? t.complete
          : t.scan;

  return (
    <div className="min-h-screen bg-[#f7f9f7] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Wallet size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-emerald-700 dark:text-emerald-400">
                Hisaab <span lang="ur">| حساب</span>
              </p>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                {t.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  language === "en"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ur")}
                aria-pressed={language === "ur"}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  language === "ur"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                اردو
              </button>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-emerald-400"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
        <section aria-label="Bill summary" className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={<Wallet size={19} />}
            title={t.totalDues}
            value={formatPkr(totalDues)}
            accent
          />
          <MetricCard
            icon={<FileText size={19} />}
            title={t.billsScanned}
            value={completedBills.length.toLocaleString("en-PK")}
          />
          <MetricCard
            icon={<Wallet size={19} />}
            title={t.highestBill}
            value={formatPkr(highestBill)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{t.uploadTitle}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {language === "en"
                ? "Keep all your household bills together and understand what you owe."
                : "اپنے گھر کے تمام بل ایک جگہ رکھیں اور واجب الادا رقم جانیں۔"}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            disabled={isScanning}
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              if (!isScanning) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!isScanning) handleDrop(event);
            }}
            disabled={isScanning}
            className="group flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition group-hover:scale-105 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Upload size={23} aria-hidden="true" />
            </span>
            <span className="max-w-xl text-base font-semibold sm:text-lg">
              {t.dropPrompt}
            </span>
            <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t.fileTypes}
            </span>
          </button>

          {errorMessage && (
            <p
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <AlertCircle size={17} className="shrink-0" />
              {errorMessage}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning || !bills.some((bill) => bill.status === "queued")}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-700/15 transition hover:-translate-y-0.5 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:disabled:bg-slate-700"
            >
              {isScanning ? (
                <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
              ) : stage === "complete" ? (
                <CheckCircle2 size={20} aria-hidden="true" />
              ) : (
                <FileText size={20} aria-hidden="true" />
              )}
              {scanLabel}
              {language === "en" && <span lang="ur">/ بل اسکین کریں</span>}
            </button>

            <div className="flex-1" aria-live="polite">
              <div className="mb-2 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>
                  {stage === "complete"
                    ? t.complete
                    : stage === "calculating"
                      ? t.calculating
                      : stage === "reading"
                        ? t.reading
                        : `${progress}%`}
                </span>
                <span>{progress}%</span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-label={scanLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="selected-bills-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="selected-bills-heading" className="text-lg font-semibold">
              {t.selected}
            </h2>
            {bills.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {bills.length}
              </span>
            )}
          </div>
          {bills.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {t.empty}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {bills.map((bill) => (
                <li
                  key={bill.id}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <FileText size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {bill.file.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {bill.status === "complete"
                        ? `${t.scanned} · ${formatPkr(Number(bill.result?.level1?.total_amount_due) || 0)}`
                        : bill.status === "error"
                          ? t.failed
                          : bill.status === "scanning"
                            ? t.reading
                            : t.waiting}
                    </span>
                  </span>
                  {bill.status === "complete" ? (
                    <button
                      type="button"
                      onClick={() => setActiveBillId(bill.id)}
                      aria-label={`${language === "en" ? "View bill" : "بل دیکھیں"} ${bill.file.name}`}
                      className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 ${
                        activeBillId === bill.id
                          ? "bg-emerald-50 dark:bg-emerald-950/40"
                          : ""
                      }`}
                    >
                      <Eye size={17} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {language === "en" ? "View bill" : "بل دیکھیں"}
                      </span>
                    </button>
                  ) : bill.status === "error" ? (
                    <AlertCircle
                      size={19}
                      className="shrink-0 text-rose-600 dark:text-rose-400"
                      aria-label={t.failed}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemove(bill.id)}
                      disabled={isScanning}
                      aria-label={`${t.remove} ${bill.file.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed dark:hover:bg-rose-950/40"
                    >
                      <X size={17} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeBill && activeBill.result && (
          <BillViewer
            key={activeBill.id}
            file={activeBill.file}
            documentUrl={activeBill.previewUrl}
            language={language}
            level1={activeBill.result.level1}
            level2={activeBill.result.level2}
          />
        )}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl justify-end px-5 pb-8 sm:px-8">
        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={isDownloadingReport || isScanning}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          {isDownloadingReport ? (
            <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={17} aria-hidden="true" />
          )}
          <span>Download Monthly Report / ماہانہ رپورٹ</span>
        </button>
      </footer>
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20"
        >
          <CheckCircle2 size={19} aria-hidden="true" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, title, value, accent = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {icon}
        </span>
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <p
        className={`mt-5 text-2xl font-bold tracking-tight sm:text-3xl ${
          accent ? "text-emerald-700 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}
