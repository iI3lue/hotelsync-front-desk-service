-- AlterTable
ALTER TABLE "room_assignments" ADD COLUMN "physical_room_id" UUID;

-- AlterTable
ALTER TABLE "arrivals" ADD COLUMN "guest_name" VARCHAR(255);
