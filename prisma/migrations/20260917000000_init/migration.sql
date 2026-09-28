-- CreateTable
CREATE TABLE "room_assignments" (
    "assignment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "physical_room_number" VARCHAR(20) NOT NULL,
    "checked_in_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_out_at" TIMESTAMPTZ(6),

    CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "guest_incidents" (
    "incident_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_incidents_pkey" PRIMARY KEY ("incident_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_assignments_booking_id_key" ON "room_assignments"("booking_id");

-- CreateIndex
CREATE INDEX "room_assignments_booking_id_idx" ON "room_assignments"("booking_id");

-- CreateIndex
CREATE INDEX "guest_incidents_booking_id_idx" ON "guest_incidents"("booking_id");
