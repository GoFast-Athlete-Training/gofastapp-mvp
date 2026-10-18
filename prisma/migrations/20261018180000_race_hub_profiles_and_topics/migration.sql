-- Remap legacy race hub chatter topics to three channels
UPDATE "race_messages" SET "topic" = 'my-goal-time' WHERE "topic" = 'pace-goals';
UPDATE "race_messages" SET "topic" = 'questions' WHERE "topic" = 'ask-the-community';
UPDATE "race_messages" SET "topic" = 'general' WHERE "topic" IN (
  'getting-there',
  'logistics',
  'social-meetups',
  'tips'
);
