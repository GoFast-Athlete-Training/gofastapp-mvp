/**
 * Run instance workflow vs published — two columns, coupled at write boundaries.
 *
 * | Field            | Meaning                                      |
 * |------------------|----------------------------------------------|
 * | workflowStatus   | Internal workflow (DEVELOP → … → APPROVED)   |
 * | published        | Public runs feed visibility                  |
 *
 * Founder go-live couples both fields only at write boundaries:
 *   - Approve (APPROVED)  → also published: true
 *   - Publish (true)      → also workflowStatus: APPROVED
 * Demoting to DEVELOP/PENDING → also published: false
 * Unpublishing (false) leaves workflowStatus unchanged.
 *
 * Read gates use the column they mean — never infer one from the other.
 */

export type RunWorkflowStatus = 'DEVELOP' | 'PENDING' | 'SUBMITTED' | 'APPROVED';

export function isRunApproved(run: { workflowStatus?: string | null }): boolean {
  return run.workflowStatus === 'APPROVED';
}

export function isRunPublished(run: { published?: boolean | null }): boolean {
  return run.published === true;
}

/** Public app eligibility — both columns required for full live (feed + RSVP). */
export function isRunFullyLive(run: {
  workflowStatus?: string | null;
  published?: boolean | null;
}): boolean {
  return isRunApproved(run) && isRunPublished(run);
}

/** Write boundary: setting workflowStatus (also publishes when approving). */
export function fieldsWhenSettingWorkflowStatus(workflowStatus: RunWorkflowStatus): {
  workflowStatus: RunWorkflowStatus;
  published?: boolean;
} {
  if (workflowStatus === 'APPROVED') {
    return { workflowStatus, published: true };
  }
  if (workflowStatus === 'DEVELOP' || workflowStatus === 'PENDING') {
    return { workflowStatus, published: false };
  }
  return { workflowStatus };
}

/** Write boundary: setting published (also approves when going live). */
export function fieldsWhenSettingPublished(published: boolean): {
  published: boolean;
  workflowStatus?: RunWorkflowStatus;
} {
  if (published) {
    return { published: true, workflowStatus: 'APPROVED' };
  }
  return { published: false };
}

/** Bulk update data for workflowStatus changes. */
export function bulkDataWhenSettingWorkflowStatus(
  workflowStatus: RunWorkflowStatus
): { workflowStatus: RunWorkflowStatus; published?: boolean; updatedAt: Date } {
  const fields = fieldsWhenSettingWorkflowStatus(workflowStatus);
  return { ...fields, updatedAt: new Date() };
}

/** Bulk update data for publishing runs live. */
export function bulkDataWhenPublishing(): {
  published: true;
  workflowStatus: 'APPROVED';
  updatedAt: Date;
} {
  return {
    published: true,
    workflowStatus: 'APPROVED',
    updatedAt: new Date(),
  };
}
