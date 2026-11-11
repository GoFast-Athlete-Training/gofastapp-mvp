"use client";

import type { ReactNode } from "react";
import RunManageOpenCorePanel from "@/components/runmanage/runInstanceWizard/RunManageOpenCorePanel";
import RunManageAssociateStep from "@/components/runmanage/runInstanceWizard/RunManageAssociateStep";
import RunManageRunDashboardSideColumn from "@/components/runmanage/RunManageRunDashboardSideColumn";
import type { RunAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import type { RunClubPublicSources } from "@/components/runmanage/runInstanceWizard/RunClubPublicSourcesCard";
import RunManageClubSourceLinks from "@/components/runmanage/RunManageClubSourceLinks";
import RunManageClubMetaOnRun, { type RunClubMetaOnRun } from "@/components/runmanage/RunManageClubMetaOnRun";
import RunManageRunCheckBar from "@/components/runmanage/RunManageRunCheckBar";
import type { RunClubMetaForValidate } from "@/lib/runmanage/run-validate-llm-packet";
import type { RunDashboardInstanceToolbar } from "@/components/runmanage/run-dashboard-instance-toolbar";

export type { RunDashboardInstanceToolbar };

type Props = {
  values: RunInstanceWizardValues;
  onChange: (next: RunInstanceWizardValues) => void;
  context: RunInstanceWizardContext;
  weekdayMismatch: boolean;
  cityLabel: string;
  publicSources?: RunClubPublicSources | null;
  clubMetaOnRun?: RunClubMetaOnRun | null;
  checkClubMeta?: RunClubMetaForValidate | null;
  seriesSourceText?: string | null;
  publicDescriptionContext?: {
    cityRunType?: string | null;
    clubName?: string | null;
  };
  associateDraft?: RunAffiliationDraft;
  onAssociateChange?: (draft: RunAffiliationDraft) => void;
  onAssociateSave?: () => void;
  associateSaving?: boolean;
  associateError?: string | null;
  associateMessage?: string | null;
  instanceToolbar?: RunDashboardInstanceToolbar;
  error?: string | null;
  onErrorChange?: (msg: string | null) => void;
  onRunRefreshed?: () => void;
  headerSlot?: ReactNode;
};

export default function RunManageStaffRunDashboard({
  values,
  onChange,
  context,
  weekdayMismatch,
  cityLabel,
  publicSources,
  clubMetaOnRun,
  checkClubMeta,
  seriesSourceText,
  publicDescriptionContext,
  associateDraft,
  onAssociateChange,
  onAssociateSave,
  associateSaving = false,
  associateError,
  associateMessage,
  instanceToolbar,
  error,
  onErrorChange,
  onRunRefreshed,
  headerSlot,
}: Props) {
  const patch = (partial: Partial<RunInstanceWizardValues>) => onChange({ ...values, ...partial });
  const showAssociateStep = Boolean(associateDraft && onAssociateChange);

  const cityRunId = context.cityRunId?.trim() ?? "";

  return (
    <div className="space-y-4">
      {headerSlot}

      {cityRunId ? (
        <RunManageRunCheckBar
          cityRunId={cityRunId}
          cityLabel={cityLabel}
          values={values}
          clubMeta={checkClubMeta}
          seriesSourceText={seriesSourceText}
          onRunRefreshed={onRunRefreshed}
        />
      ) : null}

      {clubMetaOnRun ? <RunManageClubMetaOnRun club={clubMetaOnRun} /> : null}

      {publicSources ? <RunManageClubSourceLinks runClub={publicSources} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <RunManageRunDashboardSideColumn
          values={values}
          patch={patch}
          context={context}
          onErrorChange={onErrorChange}
          onRunRefreshed={onRunRefreshed}
          instanceToolbar={instanceToolbar}
        />

        <div className="min-w-0 space-y-4">
          {showAssociateStep && associateDraft && onAssociateChange ? (
            <RunManageAssociateStep
              cityRunType={context.cityRunType}
              draft={associateDraft}
              onChange={onAssociateChange}
              onSave={() => onAssociateSave?.()}
              saving={associateSaving}
              error={associateError}
              message={associateMessage}
            />
          ) : null}

          <RunManageOpenCorePanel
            values={values}
            onChange={onChange}
            patch={patch}
            context={context}
            weekdayMismatch={weekdayMismatch}
            onErrorChange={onErrorChange}
            associateDraft={associateDraft ?? null}
            panelTitle="Run details"
            showRegistrationFields={context.cityRunType === "RACE_SHAKEOUT"}
            staffDashboardLayout
            publicDescriptionContext={publicDescriptionContext}
          />

        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
