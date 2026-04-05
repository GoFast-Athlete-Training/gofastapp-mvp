-- GoFast Container: opt-in community on an athlete's GoFast Page (memberships + chatter)

ALTER TABLE "Athlete" ADD COLUMN "isGoFastContainer" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "gofast_container_memberships" (
    "id" TEXT NOT NULL,
    "containerAthleteId" TEXT NOT NULL,
    "memberAthleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gofast_container_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gofast_container_memberships_containerAthleteId_memberAthleteId_key" ON "gofast_container_memberships"("containerAthleteId", "memberAthleteId");
CREATE INDEX "gofast_container_memberships_containerAthleteId_idx" ON "gofast_container_memberships"("containerAthleteId");

ALTER TABLE "gofast_container_memberships" ADD CONSTRAINT "gofast_container_memberships_containerAthleteId_fkey" FOREIGN KEY ("containerAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gofast_container_memberships" ADD CONSTRAINT "gofast_container_memberships_memberAthleteId_fkey" FOREIGN KEY ("memberAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "gofast_container_messages" (
    "id" TEXT NOT NULL,
    "containerAthleteId" TEXT NOT NULL,
    "authorAthleteId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gofast_container_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gofast_container_messages_containerAthleteId_createdAt_idx" ON "gofast_container_messages"("containerAthleteId", "createdAt");

ALTER TABLE "gofast_container_messages" ADD CONSTRAINT "gofast_container_messages_containerAthleteId_fkey" FOREIGN KEY ("containerAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gofast_container_messages" ADD CONSTRAINT "gofast_container_messages_authorAthleteId_fkey" FOREIGN KEY ("authorAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
