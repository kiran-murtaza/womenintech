"use client";

import { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
} from "lucide-react";

export default function BillInspector({ billData, level1Data, level2Data }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [activeTab, setActiveTab] = useState("level1");
  const [expandedQs, setExpandedQs] = useState({});

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const toggleQ = (qNum) => {
    setExpandedQs((prev) => ({ ...prev, [qNum]: !prev[qNum] }));
  };

  return (
    <div className="flex h-full w-full bg-primary overflow-hidden">
      {/* Left Pane: Document Viewer */}
      <div className="w-1/2 border-r border-accent flex flex-col bg-black/20">
        {/* Toolbar */}
        <div className="h-12 border-b border-accent bg-secondary/50 flex items-center justify-between px-4 shrink-0">
          <div className="text-sm font-semibold text-offwhite/80">
            Document Viewer
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-accent rounded text-offwhite/70 hover:text-offwhite transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-mono text-offwhite/50 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-accent rounded text-offwhite/70 hover:text-offwhite transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <div className="w-px h-4 bg-accent mx-1"></div>
            <button
              onClick={handleRotate}
              className="p-1.5 hover:bg-accent rounded text-offwhite/70 hover:text-offwhite transition-colors"
              title="Rotate"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-accent rounded text-offwhite/70 hover:text-offwhite transition-colors"
              title="Reset View"
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto relative flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          <div
            className="relative transition-transform duration-200 ease-out border shadow-2xl bg-white"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              width: "500px",
              height: "700px",
            }}
          >
            {/* Placeholder for PDF/Image */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              [ Document Image Placeholder ]
            </div>

            {/* Mock Overlay Bounding Region */}
            <div
              className="absolute border-2 border-active bg-active/20 rounded cursor-pointer hover:bg-active/30 transition-colors"
              style={{ top: "20%", left: "10%", width: "40%", height: "8%" }}
            >
              <span className="absolute -top-5 left-0 text-[10px] bg-active text-primary px-1 rounded shadow-sm font-mono font-bold">
                total_amount_due
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Extraction Verification Workbench */}
      <div className="w-1/2 flex flex-col bg-secondary">
        {/* Tabs */}
        <div className="flex border-b border-accent shrink-0">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "level1" ? "text-active border-b-2 border-active bg-active/5" : "text-offwhite/60 hover:text-offwhite/80 hover:bg-accent/30"}`}
            onClick={() => setActiveTab("level1")}
          >
            Level 1 Schema
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "level2" ? "text-active border-b-2 border-active bg-active/5" : "text-offwhite/60 hover:text-offwhite/80 hover:bg-accent/30"}`}
            onClick={() => setActiveTab("level2")}
          >
            Level 2 Questions
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* LEVEL 1 TAB */}
          {activeTab === "level1" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs uppercase tracking-wider text-offwhite/40 mb-2">
                Structured Extraction
              </h3>

              {/* Field: Bill ID */}
              <div className="flex flex-col gap-1.5 group">
                <label className="text-xs text-offwhite/70 flex justify-between">
                  bill_id
                  <CheckCircle2 size={14} className="text-active" />
                </label>
                <input
                  type="text"
                  defaultValue={level1Data?.bill_id || "INV-99283-2024"}
                  className="bg-primary border border-accent rounded px-3 py-2 text-sm text-offwhite focus:border-active focus:ring-1 focus:ring-active outline-none font-mono"
                />
              </div>

              {/* Field: Total Amount */}
              <div className="flex flex-col gap-1.5 group">
                <label className="text-xs text-offwhite/70 flex justify-between">
                  total_amount_due
                  <AlertTriangle
                    size={14}
                    className="text-warning"
                    title="Low Confidence"
                  />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-offwhite/40 font-mono">
                    $
                  </span>
                  <input
                    type="text"
                    defaultValue={level1Data?.total_amount_due || "1,245.00"}
                    className="bg-warning/10 border border-warning/50 rounded pl-7 pr-3 py-2 text-sm text-offwhite focus:border-warning focus:ring-1 focus:ring-warning outline-none w-full font-mono"
                  />
                </div>
              </div>

              {/* Field: Tariff Code */}
              <div className="flex flex-col gap-1.5 group">
                <label className="text-xs text-offwhite/70 flex justify-between">
                  tariff_code
                  <CheckCircle2 size={14} className="text-active" />
                </label>
                <input
                  type="text"
                  defaultValue={level1Data?.tariff_code || "RES-A-TIER2"}
                  className="bg-primary border border-accent rounded px-3 py-2 text-sm text-offwhite focus:border-active focus:ring-1 focus:ring-active outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* LEVEL 2 TAB */}
          {activeTab === "level2" && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase tracking-wider text-offwhite/40 mb-2">
                Q&A Matrix
              </h3>

              {[1, 2, 3].map((qNum) => (
                <div
                  key={qNum}
                  className="border border-accent rounded bg-primary overflow-hidden"
                >
                  <button
                    onClick={() => toggleQ(qNum)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-active">
                        Q{qNum}
                      </span>
                      <span className="text-sm text-offwhite/90">
                        What is the{" "}
                        {qNum === 1
                          ? "account holder name"
                          : qNum === 2
                            ? "service address"
                            : "total amount due"}
                        ?
                      </span>
                    </div>
                    {expandedQs[qNum] ? (
                      <ChevronUp size={16} className="text-offwhite/50" />
                    ) : (
                      <ChevronDown size={16} className="text-offwhite/50" />
                    )}
                  </button>

                  {expandedQs[qNum] && (
                    <div className="p-3 border-t border-accent bg-black/20 flex flex-col gap-2">
                      <div className="text-sm text-offwhite font-medium">
                        {qNum === 1
                          ? "Acme Corp LLC"
                          : qNum === 2
                            ? "123 Tech Boulevard, Suite 400"
                            : "$1,245.00"}
                      </div>
                      <div className="text-xs text-offwhite/50 border-l-2 border-active pl-2 italic">
                        Citation: "...billed to Acme Corp LLC at 123 Tech
                        Boulevard..."
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-accent bg-primary shrink-0 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
          <button className="flex items-center gap-2 text-sm font-medium text-offwhite/70 hover:text-offwhite px-4 py-2 rounded hover:bg-accent transition-colors">
            <RefreshCw size={16} />
            Re-run Extraction
          </button>

          <button className="flex items-center gap-2 text-sm font-medium bg-active text-primary px-5 py-2 rounded hover:bg-active/90 transition-colors shadow-lg shadow-active/20">
            <Save size={16} />
            Confirm & Save to CSV
          </button>
        </div>
      </div>
    </div>
  );
}
