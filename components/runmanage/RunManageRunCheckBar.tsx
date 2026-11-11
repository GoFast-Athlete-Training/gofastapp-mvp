"use client";

import { useCallback, useMemo, useState } from "react";
import { ClipboardCopy, Upload, X } from "lucide-react";
import { RunManageDayCorrectionsDialog } from "@/components/runmanage/RunManageDayCorrectionsDialog";
import {
  buildRunValidateLlmPacket,
  type RunClubMetaForValidate,
} from "@/lib/runmanage/run-validate-llm-packet";
import type { RunValidateSnapshot } from "@/lib/runmanage/run-validate-snapshot-csv";
import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";

type Props = {
  cityRunId: string;
  cityLabel: string;
  values: RunInstanceWizardValues;
  clubMeta?: RunClubMetaForValidate | null;
  seriesSourceText?: string | null;
  onRunRefreshed?: () => void;
};

export default function RunManageRunCheckBar({
  cityRunId,
  cityLabel,
  values,
  clubMeta,
  seriesSourceText,
  onRunRefreshed,
}: Props) {
  const [llmOpen, setLlmOpen] = useState(false);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);

  const { packet, row: runsForParse, snapshot } = useMemo(
    () =>
      buildRunValidateLlmPacket({
        cityLabel,
        run: {
          id: cityRunId,
          title: values.title,
          date: values.date,
          startTimeHour: values.startTimeHour ? Number(values.startTimeHour) : null,
          startTimeMinute: values.startTimeMinute ? Number(values.startTimeMinute) : null,
          startTimePeriod: values.startTimePeriod || null,
          startTimeHourStr: values.startTimeHour,
          startTimeMinuteStr: values.startTimeMinute,
          startTimePeriodStr: values.startTimePeriod,
          meetUpPoint: values.meetUpPoint,
          stravaEventUrl: values.stravaEventUrl,
          webUrl: values.webUrl,
          seriesSourceText,
          clubMeta: clubMeta ?? null,
        },
      }),
    [cityRunId, cityLabel, values, clubMeta, seriesSourceText]
  );

  const allowedRunIds = cityRunId ? [cityRunId] : [];

  const copyPacket = useCallback(async () => {
    await navigator.clipboard.writeText(packet);
    setCopiedPacket(true);
    setTimeout(() => setCopiedPacket(false), 2000);
  }, [packet]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3">
        <p className="mr-auto text-xs font-medium text-violet-950">
          Validate against club sources before editing fields below.
        </p>
        <button
          type="button"
          disabled={!cityRunId}
          onClick={() => setLlmOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          <ClipboardCopy className="h-4 w-4" />
          Check this run
        </button>
        <button
          type="button"
          disabled={!cityRunId}
          onClick={() => setCorrectionsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Apply corrections
        </button>
      </div>

      {llmOpen ? (
        <RunLlmPacketDialog
          packet={packet}
          copied={copiedPacket}
          onCopy={() => void copyPacket()}
          onClose={() => setLlmOpen(false)}
        />
      ) : null}

      <RunManageDayCorrectionsDialog
        open={correctionsOpen}
        onClose={() => setCorrectionsOpen(false)}
        allowedRunIds={allowedRunIds}
        runsForParse={[runsForParse]}
        runSnapshotBaseline={snapshot}
        singleRunMode
        onApplied={() => onRunRefreshed?.()}
      />
    </>
  );
}

function RunLlmPacketDialog({
  packet,
  copied,
  onCopy,
  onClose,
}: {
  packet: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Check this run — LLM packet</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <textarea
          readOnly
          value={packet}
          className="min-h-[280px] flex-1 resize-none border-0 px-4 py-3 font-mono text-xs text-gray-800 focus:ring-0"
        />
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          >
            <ClipboardCopy className="h-4 w-4" />
            {copied ? "Copied" : "Copy packet"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
