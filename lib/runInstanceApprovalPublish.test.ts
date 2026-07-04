import { describe, expect, it } from 'vitest';
import {
  bulkDataWhenPublishing,
  bulkDataWhenSettingWorkflowStatus,
  fieldsWhenSettingPublished,
  fieldsWhenSettingWorkflowStatus,
  isRunFullyLive,
} from './runInstanceApprovalPublish';

describe('runInstanceApprovalPublish', () => {
  it('publish couples to APPROVED', () => {
    expect(fieldsWhenSettingPublished(true)).toEqual({
      published: true,
      workflowStatus: 'APPROVED',
    });
  });

  it('unpublish does not change workflow', () => {
    expect(fieldsWhenSettingPublished(false)).toEqual({ published: false });
  });

  it('approve couples to published', () => {
    expect(fieldsWhenSettingWorkflowStatus('APPROVED')).toEqual({
      workflowStatus: 'APPROVED',
      published: true,
    });
  });

  it('demote to DEVELOP unpublishes', () => {
    expect(fieldsWhenSettingWorkflowStatus('DEVELOP')).toEqual({
      workflowStatus: 'DEVELOP',
      published: false,
    });
  });

  it('SUBMITTED does not touch published', () => {
    expect(fieldsWhenSettingWorkflowStatus('SUBMITTED')).toEqual({
      workflowStatus: 'SUBMITTED',
    });
  });

  it('bulk publish sets both flags', () => {
    expect(bulkDataWhenPublishing()).toMatchObject({
      published: true,
      workflowStatus: 'APPROVED',
    });
  });

  it('bulk approve sets both flags', () => {
    expect(bulkDataWhenSettingWorkflowStatus('APPROVED')).toMatchObject({
      workflowStatus: 'APPROVED',
      published: true,
    });
  });

  it('isRunFullyLive requires both', () => {
    expect(isRunFullyLive({ workflowStatus: 'APPROVED', published: true })).toBe(true);
    expect(isRunFullyLive({ workflowStatus: 'APPROVED', published: false })).toBe(false);
    expect(isRunFullyLive({ workflowStatus: 'SUBMITTED', published: true })).toBe(false);
  });
});
