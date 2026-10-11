import { handleBookingEvent } from "../../src/lib/consumer.js";

const BOOKING_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const HOTEL_ID = "c1b2c3d4-e5f6-4890-abcd-ef1234567890";
const ROOM_TYPE_ID = "d1b2c3d4-e5f6-4890-abcd-ef1234567890";
const GUEST_ID = "b1b2c3d4-e5f6-4890-abcd-ef1234567890";

function mockDb() {
  return {
    arrival: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;
}

describe("handleBookingEvent", () => {
  it("should upsert the arrival as confirmed on booking.confirmed", async () => {
    const db = mockDb();

    await handleBookingEvent(db, "booking.confirmed", {
      booking_id: BOOKING_ID,
      guest_id: GUEST_ID,
      guest_name: "Ana",
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_TYPE_ID,
      check_in: "2026-10-01",
      check_out: "2026-10-05",
      channel: "direct",
    } as any);

    expect(db.arrival.upsert).toHaveBeenCalledWith({
      where: { booking_id: BOOKING_ID },
      create: {
        booking_id: BOOKING_ID,
        guest_id: GUEST_ID,
        guest_name: "Ana",
        hotel_id: HOTEL_ID,
        room_type_id: ROOM_TYPE_ID,
        check_in: new Date("2026-10-01"),
        check_out: new Date("2026-10-05"),
        channel: "direct",
        status: "confirmed",
      },
      update: {
        guest_id: GUEST_ID,
        guest_name: "Ana",
        hotel_id: HOTEL_ID,
        room_type_id: ROOM_TYPE_ID,
        check_in: new Date("2026-10-01"),
        check_out: new Date("2026-10-05"),
        channel: "direct",
        status: "confirmed",
      },
    });
    expect(db.arrival.updateMany).not.toHaveBeenCalled();
  });

  it("should ignore booking.created because it only represents a pending booking", async () => {
    const db = mockDb();

    await handleBookingEvent(db, "booking.created", {
      booking_id: BOOKING_ID,
      guest_id: GUEST_ID,
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_TYPE_ID,
      check_in: "2026-10-01",
      check_out: "2026-10-05",
    } as any);

    expect(db.arrival.upsert).not.toHaveBeenCalled();
    expect(db.arrival.updateMany).not.toHaveBeenCalled();
  });

  it("should default a missing guest name to null on confirmation", async () => {
    const db = mockDb();

    await handleBookingEvent(db, "booking.confirmed", {
      booking_id: BOOKING_ID,
      guest_id: GUEST_ID,
      hotel_id: HOTEL_ID,
      room_type_id: ROOM_TYPE_ID,
      check_in: "2026-10-01",
      check_out: "2026-10-05",
    } as any);

    expect(db.arrival.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ guest_name: null }),
        update: expect.objectContaining({ guest_name: null }),
      })
    );
  });

  it("should mark the arrival as cancelled on booking.cancelled (idempotent, no junk rows)", async () => {
    const db = mockDb();

    await handleBookingEvent(db, "booking.cancelled", {
      booking_id: BOOKING_ID,
    } as any);

    expect(db.arrival.updateMany).toHaveBeenCalledWith({
      where: { booking_id: BOOKING_ID },
      data: { status: "cancelled" },
    });
    expect(db.arrival.upsert).not.toHaveBeenCalled();
  });

  it("should ignore unknown routing keys", async () => {
    const db = mockDb();

    await handleBookingEvent(db, "folio.closed", {
      booking_id: BOOKING_ID,
    } as any);

    expect(db.arrival.upsert).not.toHaveBeenCalled();
    expect(db.arrival.updateMany).not.toHaveBeenCalled();
  });
});
