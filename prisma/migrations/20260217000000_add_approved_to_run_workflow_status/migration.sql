-- Add APPROVED to RunWorkflowStatus enum (mirror club approval flow: DRAFT -> SUBMITTED -> APPROVED)
ALTER TYPE "RunWorkflowStatus" ADD VALUE 'APPROVED';
