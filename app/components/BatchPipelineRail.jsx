"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  Download,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  Settings2,
  TerminalSquare,
} from "lucide-react";

// Mock Data
const MOCK_QUEUE = [
  { id: 1, name: "january_electric_bill.pdf", status: "complete" },
  { id: 2, name: "february_water_bill.png", status: "processing" },
  { id: 3, name: "march_gas_invoice.jpg", status: "queued" },
  { id: 4, name: "april_electric_bill_corrupt.pdf", status: "failed" },
  { id: 5, name: "may_water_bill.pdf", status: "queued" },
];

const STAGES = [
  { id: 1, label: "Document Loading & Preprocessing" },
  { id: 2, label: "Level 1 JSON Schema Extraction" },
  { id: 3, label: "Level 2 Q&A Processing" },
  { id: 4, label: "CSV Export & Formatting" },
];

const MOCK_LOGS = [
  "[11:42:01] INFO: Initializing Batch Pipeline...",
  "[11:42:02] INFO: Detected 5 files in target directory.",
  "[11:42:03] SUCCESS: january_electric_bill.pdf processing complete. CSVs appended.",
  "[11:42:04] INFO: Starting processing for february_water_bill.png...",
  "[11:42:05] SYSTEM: Running Level 1 JSON Extraction (Model: gemini-2.0-flash-lite)",
];

export default function BatchPipelineRail() {
  const [isRunning, setIsRunning] = useState(true);
  const [currentStage, setCurrentStage] = useState(2); // Mocking Stage 2 active

  const StatusIcon = ({ status }) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 size={16} className="text-active" />;
      case "processing":
        return <Loader2 size={16} className="text-blue-400 animate-spin" />;
      case "queued":
        return <Clock size={16} className="text-offwhite/40" />;
      case "failed":
        return <AlertCircle size={16} className="text-warning" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-primary overflow-hidden">
      {/* Top Controls & Horizontal Stepper Rail */}
      <div className="flex flex-col bg-secondary border-b border-accent shrink-0">
        {/* Action Bar */}
        <div className="flex items-center justify-between p-4 border-b border-accent/50">
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-active" />
            <h2 className="text-lg font-medium text-offwhite">
              Batch Pipeline Control
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-active/10 border border-active/30 text-active text-xs font-mono ml-2">
              RUNNING
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRunning(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-active/20 text-active hover:bg-active/30 border border-active/50 transition-colors text-sm font-medium"
            >
              <Play size={16} /> Process All Batch
            </button>
            <button
              onClick={() => setIsRunning(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-warning/20 text-warning hover:bg-warning/30 border border-warning/50 transition-colors text-sm font-medium"
            >
              <Pause size={16} /> Pause Batch
            </button>
            <div className="w-px h-6 bg-accent mx-1"></div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary text-offwhite hover:bg-accent border border-accent transition-colors text-sm font-medium">
              <Download size={16} /> Export CSVs Now
            </button>
          </div>
        </div>

        {/* Live Pipeline Visual Rail (Stepper) */}
        <div className="p-6 flex items-center justify-between relative">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-accent -translate-y-1/2 z-0"></div>
          <div
            className="absolute top-1/2 left-8 h-0.5 bg-active -translate-y-1/2 z-0 transition-all duration-1000"
            style={{
              width: `${((currentStage - 1) / (STAGES.length - 1)) * 100}%`,
            }}
          ></div>

          {STAGES.map((stage, index) => {
            const isCompleted = index + 1 < currentStage;
            const isActive = index + 1 === currentStage;
            const isPending = index + 1 > currentStage;

            return (
              <div
                key={stage.id}
                className="relative z-10 flex flex-col items-center gap-2 bg-secondary px-2"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-colors
                    ${isCompleted ? "bg-active border-active text-primary" : ""}
                    ${isActive ? "bg-primary border-active text-active shadow-[0_0_15px_rgba(16,185,129,0.3)]" : ""}
                    ${isPending ? "bg-primary border-accent text-offwhite/40" : ""}
                  `}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : stage.id}
                </div>
                <div
                  className={`text-xs font-medium text-center w-32 ${isActive ? "text-active" : isPending ? "text-offwhite/40" : "text-offwhite/80"}`}
                >
                  {stage.label}
                  {isActive && (
                    <div className="text-[10px] text-active/70 animate-pulse mt-1">
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content: Queue and Logs */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Queue List */}
        <div className="w-1/3 border-r border-accent flex flex-col bg-primary">
          <div className="p-3 border-b border-accent bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-offwhite/50 flex justify-between items-center">
            <span>Detected File Queue (5)</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {MOCK_QUEUE.map((file) => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-3 border-b border-accent/30 hover:bg-accent/10 transition-colors ${file.status === "processing" ? "bg-accent/20 border-l-2 border-l-active" : "border-l-2 border-l-transparent"}`}
              >
                <div className="flex items-center gap-3 truncate">
                  <FileText
                    size={16}
                    className={
                      file.status === "processing"
                        ? "text-active"
                        : "text-offwhite/50"
                    }
                  />
                  <span
                    className={`text-sm truncate ${file.status === "failed" ? "text-warning/70 line-through" : "text-offwhite/90"}`}
                  >
                    {file.name}
                  </span>
                </div>
                <StatusIcon status={file.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Execution Logs */}
        <div className="w-2/3 flex flex-col bg-[#0A0D0B] relative">
          <div className="p-3 border-b border-accent/50 bg-[#0A0D0B] text-xs font-semibold uppercase tracking-wider text-offwhite/50 flex items-center gap-2 shrink-0">
            <TerminalSquare size={16} />
            Real-time Execution Logs
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1.5 custom-scrollbar">
            {MOCK_LOGS.map((log, i) => (
              <div
                key={i}
                className={`
                ${log.includes("SUCCESS") ? "text-active" : ""}
                ${log.includes("SYSTEM") ? "text-blue-400" : ""}
                ${log.includes("INFO") ? "text-offwhite/60" : ""}
                ${log.includes("ERROR") ? "text-warning" : ""}
              `}
              >
                {log}
              </div>
            ))}
            {/* Blinking Cursor */}
            <div className="flex items-center mt-2">
              <span className="text-active animate-pulse">_</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
