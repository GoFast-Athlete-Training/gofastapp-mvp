import { prisma } from '../lib/prisma';

async function migrateRunCrewRoles() {
  try {
    console.log('🔄 Starting RunCrew role migration...\n');

    // Step 0: Check if role column exists, if not add it
    console.log('Step 0: Checking if role column exists...');
    try {
      const checkColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'run_crew_memberships' 
          AND column_name = 'role'
        ) as exists;
      `;

      if (!checkColumn[0].exists) {
        console.log('   Column "role" does not exist. Adding it...');
        // Add the enum type first if it doesn't exist
        await prisma.$executeRaw`
          DO $$ BEGIN
            CREATE TYPE "run_crew_role" AS ENUM ('member', 'admin', 'manager');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `;
        // Add the column with default value
        await prisma.$executeRaw`
          ALTER TABLE run_crew_memberships 
          ADD COLUMN IF NOT EXISTS role "run_crew_role" DEFAULT 'member';
        `;
        console.log('   ✅ Added role column with default value "member"\n');
      } else {
        console.log('   ✅ Role column already exists\n');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error checking/adding column: ${error.message}`);
      console.log('   Continuing with migration...\n');
    }

    // Step 1: Set all existing memberships to 'member' (default)
    console.log('Step 1: Setting all memberships to "member" role...');
    const update1 = await prisma.$executeRaw`
      UPDATE run_crew_memberships
      SET role = 'member'::run_crew_role
      WHERE role IS NULL OR role = 'member'::run_crew_role;
    `;
    console.log(`✅ Updated ${update1} memberships to 'member'\n`);

    // Step 2: Copy roles from run_crew_managers into run_crew_memberships.role
    console.log('Step 2: Copying roles from RunCrewManager table...');
    const update2 = await prisma.$executeRaw`
      UPDATE run_crew_memberships m
      SET role = CASE 
        WHEN rm.role = 'admin' THEN 'admin'::run_crew_role
        WHEN rm.role = 'manager' THEN 'manager'::run_crew_role
        ELSE 'member'::run_crew_role
      END
      FROM run_crew_managers rm
      WHERE m."runCrewId" = rm."runCrewId"
        AND m."athleteId" = rm."athleteId";
    `;
    console.log(`✅ Updated ${update2} memberships from RunCrewManager roles\n`);

    // Step 3: Verify no NULL roles remain
    console.log('Step 3: Verifying no NULL roles remain...');
    const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM run_crew_memberships
      WHERE role IS NULL;
    `;
    const nullRoles = Number(nullCount[0].count);
    if (nullRoles === 0) {
      console.log('✅ No NULL roles found - all memberships have roles\n');
    } else {
      console.log(`⚠️  Warning: ${nullRoles} memberships still have NULL roles\n`);
    }

    // Step 4: Show summary
    console.log('Step 4: Migration summary...');
    const summary = await prisma.$queryRaw<Array<{ role: string; count: bigint }>>`
      SELECT role::text, COUNT(*) as count
      FROM run_crew_memberships
      GROUP BY role
      ORDER BY role;
    `;
    console.log('Membership roles summary:');
    summary.forEach((row) => {
      console.log(`  ${row.role}: ${row.count}`);
    });
    console.log('');

    // Step 5: Update Adam's record specifically (find by email or first name)
    console.log('Step 5: Updating Adam\'s record...');
    const adam = await prisma.athlete.findFirst({
      where: {
        OR: [
          { email: { contains: 'adam', mode: 'insensitive' } },
          { firstName: { contains: 'adam', mode: 'insensitive' } },
        ],
      },
      include: {
        runCrewMemberships: true,
        runCrewManagers: true,
      },
    });

    if (adam) {
      console.log(`✅ Found athlete: ${adam.firstName} ${adam.lastName} (${adam.email})`);
      console.log(`   ID: ${adam.id}`);
      console.log(`   Memberships: ${adam.runCrewMemberships.length}`);
      console.log(`   Manager records: ${adam.runCrewManagers.length}`);

      // Update all of Adam's memberships to ensure they have correct roles (using raw SQL)
      for (const membership of adam.runCrewMemberships) {
        const managerRecord = adam.runCrewManagers.find(
          (m) => m.runCrewId === membership.runCrewId
        );

        if (managerRecord) {
          const role = managerRecord.role === 'admin' ? 'admin' : managerRecord.role === 'manager' ? 'manager' : 'member';
          await prisma.$executeRaw`
            UPDATE run_crew_memberships
            SET role = ${role}::run_crew_role
            WHERE id = ${membership.id};
          `;
          console.log(`   ✅ Updated membership ${membership.id} to role: ${role}`);
        } else {
          // Ensure member role is set if no manager record
          await prisma.$executeRaw`
            UPDATE run_crew_memberships
            SET role = 'member'::run_crew_role
            WHERE id = ${membership.id};
          `;
          console.log(`   ✅ Set membership ${membership.id} to role: member (no manager record)`);
        }
      }
    } else {
      console.log('⚠️  Adam not found in database');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRunCrewRoles();
