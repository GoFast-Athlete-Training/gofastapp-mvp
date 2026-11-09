import type { Prisma } from "@prisma/client";
import { positionsInclude } from "@/lib/training/preset-positions-include";

export const catalogPresetBuildInclude = {
  buildPreset: {
    include: {
      longRunConfig: { include: { positions: positionsInclude } },
      intervalsConfig: { include: { positions: positionsInclude } },
      tempoConfig: { include: { positions: positionsInclude } },
      easyConfig: { include: { positions: positionsInclude } },
    },
  },
} as const;

export type CatalogPresetWithBuild = Prisma.training_plan_presetGetPayload<{
  include: typeof catalogPresetBuildInclude;
}>;

type BuildWithRotations = NonNullable<CatalogPresetWithBuild["buildPreset"]>;

export type CatalogPresetRotationFields = {
  longRunConfig: BuildWithRotations["longRunConfig"];
  intervalsConfig: BuildWithRotations["intervalsConfig"];
  tempoConfig: BuildWithRotations["tempoConfig"];
  easyConfig: BuildWithRotations["easyConfig"];
};

/** Rotation configs for catalog presets — always from linked build_preset. */
export function rotationFromCatalogPreset(
  preset: CatalogPresetWithBuild,
): CatalogPresetRotationFields {
  const build = preset.buildPreset;
  return {
    longRunConfig: build?.longRunConfig ?? null,
    intervalsConfig: build?.intervalsConfig ?? null,
    tempoConfig: build?.tempoConfig ?? null,
    easyConfig: build?.easyConfig ?? null,
  };
}

export function poolsFromBuildPeakLongRun(peakLongRunMiles: number | null | undefined): {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
} {
  const peakPool =
    peakLongRunMiles != null && Number.isFinite(peakLongRunMiles)
      ? peakLongRunMiles * 4
      : 0;
  return {
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
  };
}
