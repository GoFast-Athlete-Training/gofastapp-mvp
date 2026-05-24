/**
 * Field inventory: which Company/MVP source fields feed each race info packet.
 *
 * Company (canonical ingest) → MVP sync → packet builder
 *
 * | Packet           | Company source                                      | MVP registry field(s)                    |
 * |------------------|-----------------------------------------------------|------------------------------------------|
 * | registration     | race_registrations.*                                | registrationUrl, registrationOpen*, fee  |
 * | course           | race_courses + race_course_segments                 | courseSlug, courseMapUrl, course_segments|
 * | trainingTips     | segments.runTip + athlete training plan             | course_segments.runTip + training_plans  |
 * | packetPickup     | race_expo (primary) → legacy flat sync              | packetPickup*                            |
 * | arrival          | race_arrival_items (public only today) + flat paste | logisticsInfo, gearDrop, spectatorInfo   |
 * | raceDayGuide     | composite of pickup + arrival + start               | same flat fields + startTime             |
 *
 * Not yet synced to MVP (future structured arrival without new top-level schema):
 * - GoFastCompany.race_arrival_items → could extend registry sync or public API proxy
 *
 * Editorial content (NOT packets — separate blog pipeline):
 * - blog_posts via race-blog-service (why-this-race, race-day-guide, course-breakdown)
 */

import type { RaceInfoPacketKind } from "./race-info-packet-types";

export type RaceInfoFieldSource = {
  packet: RaceInfoPacketKind;
  companyTables: string[];
  mvpFields: string[];
  notes?: string;
};

export const RACE_INFO_FIELD_INVENTORY: RaceInfoFieldSource[] = [
  {
    packet: "registration",
    companyTables: ["race_registrations"],
    mvpFields: [
      "registrationUrl",
      "registrationOpenNow",
      "registrationOpenDate",
      "registrationCloseDate",
      "registrationFee",
    ],
    notes: "Only shown when athlete has not added the race to My Races.",
  },
  {
    packet: "course",
    companyTables: ["race_courses", "race_course_segments"],
    mvpFields: ["courseSlug", "courseMapUrl", "course_segments", "description", "summaryPhrase"],
    notes: "Scoped to the athlete's registry row (primary distance).",
  },
  {
    packet: "trainingTips",
    companyTables: ["race_course_segments"],
    mvpFields: ["course_segments.runTip", "training_plans", "athlete_goals.goalTime"],
    notes: "Structured tips from segments; plan progress from active training_plans.",
  },
  {
    packet: "packetPickup",
    companyTables: ["race_expo"],
    mvpFields: [
      "packetPickupLocation",
      "packetPickupDate",
      "packetPickupTime",
      "packetPickupDescription",
    ],
    notes: "Derived from primary expo via race-registry-sync; emphasized inside 7 days.",
  },
  {
    packet: "arrival",
    companyTables: ["race_arrival_items", "races.logisticsInfo"],
    mvpFields: ["logisticsInfo", "gearDropInstructions", "spectatorInfo"],
    notes: "Structured arrival cards exist on Company/public; MVP uses flat snapshots today.",
  },
  {
    packet: "raceDayGuide",
    companyTables: ["race_expo", "race_arrival_items", "race_registrations"],
    mvpFields: [
      "startTime",
      "packetPickup*",
      "logisticsInfo",
      "gearDropInstructions",
      "spectatorInfo",
    ],
    notes: "Composite race-week packet; no separate ingest table.",
  },
];
