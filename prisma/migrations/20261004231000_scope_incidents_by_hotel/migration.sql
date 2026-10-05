-- Add hotel scope to incidents. Existing legacy rows remain NULL and can
-- only be queried by SUPER_ADMIN until reconciled with Booking.
ALTER TABLE "guest_incidents"
ADD COLUMN "hotel_id" UUID;

CREATE INDEX "guest_incidents_hotel_id_created_at_idx"
ON "guest_incidents"("hotel_id", "created_at");
