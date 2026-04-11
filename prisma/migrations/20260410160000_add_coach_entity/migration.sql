-- CreateTable
CREATE TABLE "coaches" (
    "id" TEXT NOT NULL,
    "firebaseId" TEXT NOT NULL,
    "email" TEXT,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "photoURL" TEXT,
    "bio" TEXT,
    "specialty" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coaches_firebaseId_key" ON "coaches"("firebaseId");

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "go_fast_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
