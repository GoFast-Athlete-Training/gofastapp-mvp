"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCopy, Loader2, Upload, X } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import type { DayValidateRunRow } from "@/lib/runmanage/day-validate-llm-packet";
import {
  extractRunSnapshotCsv,
  isRunSnapshotCsv,
  runSnapshotToDayCorrectionsCsv,
  RUN_VALIDATE_SNAPSHOT_HEADER,
  type RunValidateSnapshot,
} from "@/lib/runmanage/run-validate-snapshot-csv";

type PreviewRow = {
  line: number;
  runId: string;
  field: string;
  before: string;
  after: string;
  ok: boolean;
  reason?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  allowedRunIds: string[];
  runsForParse?: DayValidateRunRow[];
  /** When set, paste of field,value is diffed against this snapshot (single-run check). */
  runSnapshotBaseline?: RunValidateSnapshot | null;
  singleRunMode?: boolean;
  onApplied?: () => void;
};

const CSV_HINT = `runId,field,action,value
abc123,title,replace,Clarendon Run Club Monday Run (11/10)
abc123,startTime,replace,6:30 PM`;

export function RunManageDayCorrectionsDialog({
  open,
  onClose,
  allowedRunIds,
  runsForParse = [],
  runSnapshotBaseline = null,
  singleRunMode = false,
  onApplied,
}: Props) {
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [pasteText, setPasteText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPasteText("");
      setCsvText("");
      setPreview([]);
      setParseErrors([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const hasInput = (mode === "csv" ? csvText : pasteText).trim().length > 0;

  const resolveCsvText = async (): Promise<string | null> => {
  const rawInput = (mode === "csv" ? csvText : pasteText).trim();
    if (!rawInput) return null;

    const snapshotBlock = extractRunSnapshotCsv(rawInput);
    if (isRunSnapshotCsv(snapshotBlock) && runSnapshotBaseline && allowedRunIds.length === 1) {
      const { csvText: converted, parseErrors: snapErrors } = runSnapshotToDayCorrectionsCsv(
        allowedRunIds[0]!,
        runSnapshotBaseline,
        snapshotBlock
      );
      if (snapErrors.length) setParseErrors(snapErrors);
      if (!converted) {
        setError("No changed values in the returned CSV.");
        return null;
      }
      return converted;
    }

    if (mode === "csv") return rawInput;
    const trimmed = rawInput;
    const headerLooksCsv = trimmed.split(/\r?\n/)[0]?.toLowerCase().includes("runid");
    if (headerLooksCsv) return trimmed;
    const res = await runmanageApi.post("/api/runmanage/day-corrections/parse", {
      pasteText: trimmed,
      runs: runsForParse,
    });
    if (!res.data?.success && !res.data?.csvText) {
      setParseErrors((res.data?.parseErrors ?? []) as string[]);
      setError(res.data?.error || "Could not parse LLM reply");
      return null;
    }
    const parsed = String(res.data?.csvText ?? "").trim();
    setParseErrors((res.data?.parseErrors ?? []) as string[]);
    return parsed || null;
  };

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const effectiveCsv = await resolveCsvText();
      if (!effectiveCsv) {
        setError("Add paste or CSV text");
        return;
      }
      const res = await runmanageApi.post("/api/runmanage/day-corrections/preview", {
        csvText: effectiveCsv,
        allowedRunIds,
      });
      if (!res.data?.success) {
        setError(res.data?.error || "Preview failed");
        return;
      }
      setPreview((res.data.preview ?? []) as PreviewRow[]);
      setParseErrors((res.data.parseErrors ?? []) as string[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    setBusy(true);
    setError(null);
    try {
      const effectiveCsv = await resolveCsvText();
      if (!effectiveCsv) {
        setError("Add paste or CSV text");
        return;
      }
      const res = await runmanageApi.post("/api/runmanage/day-corrections/apply", {
        csvText: effectiveCsv,
        allowedRunIds,
      });
      if (!res.data?.success) {
        setError(res.data?.error || "Apply failed");
        if (res.data?.preview) setPreview(res.data.preview as PreviewRow[]);
        return;
      }
      onApplied?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        className="relative z-[201] flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {singleRunMode ? "Apply run check" : "Ingest day updates"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {singleRunMode
                ? `Paste the same field,value CSV the model returned (${RUN_VALIDATE_SNAPSHOT_HEADER}). Only changed cells apply.`
                : "Paste the LLM reply or a corrections CSV for runs on this day."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <CorrectionModeTabs mode={mode} setMode={setMode} />
          {mode === "paste" ? (
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder={singleRunMode ? RUN_VALIDATE_SNAPSHOT_HEADER : CSV_HINT}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          ) : (
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={singleRunMode ? RUN_VALIDATE_SNAPSHOT_HEADER : CSV_HINT}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          )}
          {parseErrors.length > 0 ? (
            <ul className="text-sm text-red-700">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {preview.length > 0 ? (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
              {preview.map((p) => (
                <div key={`${p.line}-${p.field}`} className="px-3 py-2">
                  <p className="font-medium">
                    Row {p.line}: {p.field}{" "}
                    {p.ok ? (
                      <span className="text-emerald-700">OK</span>
                    ) : (
                      <span className="text-red-700">{p.reason}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {p.before} → {p.after}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(CSV_HINT);
              setCopied(true);
            }}
            className="mr-auto inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
            Copy template
          </button>
          <button
            type="button"
            disabled={busy || !hasInput}
            onClick={() => void runPreview()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={busy || !hasInput}
            onClick={() => void runApply()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function CorrectionModeTabs({
  mode,
  setMode,
}: {
  mode: "paste" | "csv";
  setMode: (m: "paste" | "csv") => void;
}) {
  return (
    <div className="flex gap-2 text-sm">
      {(["paste", "csv"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            mode === m ? "bg-sky-100 text-sky-900" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {m === "paste" ? "Paste" : "CSV"}
        </button>
      ))}
    </div>
  );
}
