/**
 * Reconcile city_runs rows where published and workflowStatus disagree.
 *
 * - published=true but not APPROVED → set workflowStatus APPROVED
 * - APPROVED but published=false → set published true
 *
 * Usage: npx tsx scripts/reconcile-run-publish-approval.ts
 * Dry run: npx tsx scripts/reconcile-run-publish-approval.ts --dry-run
 */

import { prisma } from '../lib/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const publishedNotApproved = await prisma.city_runs.findMany({
    where: {
      published: true,
      workflowStatus: { not: 'APPROVED' },
    },
    select: { id: true, title: true, workflowStatus: true, published: true },
  });

  const approvedNotPublished = await prisma.city_runs.findMany({
    where: {
      workflowStatus: 'APPROVED',
      published: false,
    },
    select: { id: true, title: true, workflowStatus: true, published: true },
  });

  console.log(`published=true but workflowStatus != APPROVED: ${publishedNotApproved.length}`);
  console.log(`workflowStatus=APPROVED but published=false: ${approvedNotPublished.length}`);

  if (dryRun) {
    for (const r of publishedNotApproved) {
      console.log(`  would approve: ${r.id} (${r.title}) status=${r.workflowStatus}`);
    }
    for (const r of approvedNotPublished) {
      console.log(`  would publish: ${r.id} (${r.title})`);
    }
    return;
  }

  const approveResult = await prisma.city_runs.updateMany({
    where: {
      published: true,
      workflowStatus: { not: 'APPROVED' },
    },
    data: {
      workflowStatus: 'APPROVED',
      updatedAt: new Date(),
    },
  });

  const publishResult = await prisma.city_runs.updateMany({
    where: {
      workflowStatus: 'APPROVED',
      published: false,
    },
    data: {
      published: true,
      updatedAt: new Date(),
    },
  });

  console.log(`Updated workflowStatus→APPROVED: ${approveResult.count}`);
  console.log(`Updated published→true: ${publishResult.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
