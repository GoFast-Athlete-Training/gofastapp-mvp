export type RegistrySourceTrust = {
  sourceDiscoveryReady: boolean;
  sourceRegistrationReady: boolean;
  sourceTrainingReady: boolean;
  sourceRaceWeekReady: boolean;
};

export const DEFAULT_SOURCE_TRUST: RegistrySourceTrust = {
  sourceDiscoveryReady: true,
  sourceRegistrationReady: true,
  sourceTrainingReady: true,
  sourceRaceWeekReady: true,
};

export function trustFromRegistry(row: {
  sourceDiscoveryReady?: boolean;
  sourceRegistrationReady?: boolean;
  sourceTrainingReady?: boolean;
  sourceRaceWeekReady?: boolean;
}): RegistrySourceTrust {
  return {
    sourceDiscoveryReady: row.sourceDiscoveryReady ?? false,
    sourceRegistrationReady: row.sourceRegistrationReady ?? false,
    sourceTrainingReady: row.sourceTrainingReady ?? false,
    sourceRaceWeekReady: row.sourceRaceWeekReady ?? false,
  };
}
