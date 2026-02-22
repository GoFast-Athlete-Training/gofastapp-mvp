-- CreateEnum
CREATE TYPE "RouteShape" AS ENUM ('LOOP', 'OUT_AND_BACK', 'POINT_TO_POINT');

-- CreateEnum
CREATE TYPE "RouteTerrain" AS ENUM ('FLAT', 'ROLLING', 'HILLY', 'MIXED');

-- CreateEnum
CREATE TYPE "RouteSurface" AS ENUM ('PAVED', 'TRAIL', 'GRAVEL', 'MIXED');

-- CreateEnum
CREATE TYPE "RouteTraffic" AS ENUM ('NO_CARS', 'LOW_TRAFFIC', 'MODERATE_TRAFFIC', 'HIGH_TRAFFIC');

-- CreateEnum
CREATE TYPE "RouteLighting" AS ENUM ('FULLY_LIT', 'PARTIALLY_LIT', 'UNLIT');

-- CreateEnum
CREATE TYPE "RouteShade" AS ENUM ('FULL_SHADE', 'PARTIAL_SHADE', 'EXPOSED');

-- CreateEnum
CREATE TYPE "RouteVibe" AS ENUM ('SPEED_WORK', 'TEMPO', 'LONG_RUN', 'RECOVERY', 'SOCIAL', 'BEGINNER_FRIENDLY');

-- CreateTable
CREATE TABLE "run_locations" (
    "id" TEXT NOT NULL,
    "gofastCity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "runType" TEXT,
    "shape" "RouteShape",
    "terrain" "RouteTerrain",
    "surface" "RouteSurface",
    "traffic" "RouteTraffic",
    "lighting" "RouteLighting",
    "shade" "RouteShade",
    "vibes" "RouteVibe"[] DEFAULT ARRAY[]::"RouteVibe"[],
    "loopMiles" DOUBLE PRECISION,
    "notes" TEXT,
    "stravaUrl" TEXT,
    "meetUpPoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "run_locations_slug_key" ON "run_locations"("slug");

-- CreateIndex
CREATE INDEX "run_locations_gofastCity_idx" ON "run_locations"("gofastCity");

-- CreateIndex
CREATE INDEX "run_locations_slug_idx" ON "run_locations"("slug");

-- AlterTable: add locationId FK column to city_runs
ALTER TABLE "city_runs" ADD COLUMN "locationId" TEXT;

-- CreateIndex
CREATE INDEX "city_runs_locationId_idx" ON "city_runs"("locationId");

-- AddForeignKey
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "run_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
