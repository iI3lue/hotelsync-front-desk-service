import {
  frontDeskService,
  incidentService,
} from "../../src/services/front-desk.service.js";
import { AppError } from "../../src/middleware/error-handler.js";

// Mock Prisma
jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    roomAssignment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    guestIncident: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    arrival: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    eventOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock Booking Service client
jest.mock("../../src/lib/booking-client.js", () => ({
  fetchBooking: jest.fn(),
  fetchConfirmedBookings: jest.fn(),
}));

// Silence event stub logs
jest.mock("../../src/lib/events.js", () => ({
  publishEvent: jest.fn(),
}));

import prisma from "../../src/lib/prisma.js";
import {
  fetchBooking,
  fetchConfirmedBookings,
} from "../../src/lib/booking-client.js";

const mockPrisma = prisma as any;
const mockFetchBooking = fetchBooking as jest.Mock;
const mockFetchConfirmed = fetchConfirmedBookings as jest.Mock;

// $transaction interactiva: passthrough al mismo mock (tx === prisma mockeado)
mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

const BOOKING_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const HOTEL_ID = "c1b2c3d4-e5f6-4890-abcd-ef1234567890";

const confirmedBooking = {
  booking_id: BOOKING_ID,
  hotel_id: HOTEL_ID,
  status: "confirmed",
};

describe("FrontDeskService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getArrivals", () => {
    it("should return confirmed arrivals from the local read model", async () => {
      const arrivals = [{ booking_id: BOOKING_ID, hotel_id: HOTEL_ID }];
      mockPrisma.arrival.findMany.mockResolvedValue(arrivals);

      const result = await frontDeskService.getArrivals({
        hotel_id: HOTEL_ID,
        date: "2026-10-02",
      });

      expect(result).toEqual(arrivals);
      expect(mockPrisma.arrival.findMany).toHaveBeenCalledWith({
        where: {
          hotel_id: HOTEL_ID,
          status: "confirmed",
          check_in: { lte: new Date("2026-10-02") },
          check_out: { gte: new Date("2026-10-02") },
        },
        orderBy: { check_in: "asc" },
      });
      expect(mockFetchConfirmed).not.toHaveBeenCalled();
    });
  });

  describe("checkIn", () => {
    it("should create a room assignment for a confirmed booking", async () => {
      mockFetchBooking.mockResolvedValue(confirmedBooking);
      mockPrisma.roomAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.roomAssignment.create.mockResolvedValue({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
      });

      const result = await frontDeskService.checkIn({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
      });

      expect(mockPrisma.roomAssignment.create).toHaveBeenCalledWith({
        data: { booking_id: BOOKING_ID, physical_room_number: "101" },
      });
      expect(result.physical_room_number).toBe("101");
    });

    it("should throw 404 when booking does not exist", async () => {
      mockFetchBooking.mockResolvedValue(null);

      await expect(
        frontDeskService.checkIn({
          booking_id: BOOKING_ID,
          physical_room_number: "101",
        })
      ).rejects.toThrow(AppError);
      expect(mockPrisma.roomAssignment.create).not.toHaveBeenCalled();
    });

    it("should throw 409 when booking is not confirmed", async () => {
      mockFetchBooking.mockResolvedValue({ ...confirmedBooking, status: "pending" });

      await expect(
        frontDeskService.checkIn({
          booking_id: BOOKING_ID,
          physical_room_number: "101",
        })
      ).rejects.toThrow(AppError);
    });

    it("should throw 409 when already checked in", async () => {
      mockFetchBooking.mockResolvedValue(confirmedBooking);
      mockPrisma.roomAssignment.findUnique.mockResolvedValue({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
      });

      await expect(
        frontDeskService.checkIn({
          booking_id: BOOKING_ID,
          physical_room_number: "102",
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("checkOut", () => {
    it("should close an active check-in and emit checkout.completed + booking.completed", async () => {
      mockPrisma.roomAssignment.findUnique.mockResolvedValue({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
        checked_out_at: null,
      });
      mockPrisma.roomAssignment.update.mockResolvedValue({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
        checked_out_at: new Date(),
      });

      const result = await frontDeskService.checkOut({ booking_id: BOOKING_ID });

      expect(mockPrisma.roomAssignment.update).toHaveBeenCalledWith({
        where: { booking_id: BOOKING_ID },
        data: { checked_out_at: expect.any(Date) },
      });
      expect(result.checked_out_at).toBeTruthy();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.eventOutbox.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.eventOutbox.create).toHaveBeenNthCalledWith(1, {
        data: {
          event_type: "checkout.completed",
          payload: {
            booking_id: BOOKING_ID,
            physical_room_number: "101",
          },
        },
      });
      expect(mockPrisma.eventOutbox.create).toHaveBeenNthCalledWith(2, {
        data: {
          event_type: "booking.completed",
          payload: {
            booking_id: BOOKING_ID,
            physical_room_number: "101",
          },
        },
      });
    });

    it("should throw 404 when there is no active check-in", async () => {
      mockPrisma.roomAssignment.findUnique.mockResolvedValue(null);

      await expect(
        frontDeskService.checkOut({ booking_id: BOOKING_ID })
      ).rejects.toThrow(AppError);
    });

    it("should throw 409 when already checked out", async () => {
      mockPrisma.roomAssignment.findUnique.mockResolvedValue({
        booking_id: BOOKING_ID,
        checked_out_at: new Date(),
      });

      await expect(
        frontDeskService.checkOut({ booking_id: BOOKING_ID })
      ).rejects.toThrow(AppError);
    });
  });
});

describe("IncidentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create an incident", async () => {
    mockPrisma.guestIncident.create.mockResolvedValue({
      incident_id: "i1",
      status: "open",
    });

    const result = await incidentService.create({
      booking_id: BOOKING_ID,
      description: "Canilla goteando",
    });

    expect(result.status).toBe("open");
  });

  it("should list incidents filtered by booking", async () => {
    mockPrisma.guestIncident.findMany.mockResolvedValue([]);

    await incidentService.list(BOOKING_ID);

    expect(mockPrisma.guestIncident.findMany).toHaveBeenCalledWith({
      where: { booking_id: BOOKING_ID },
      orderBy: { created_at: "desc" },
    });
  });

  it("should throw 404 when updating a missing incident", async () => {
    mockPrisma.guestIncident.findUnique.mockResolvedValue(null);

    await expect(
      incidentService.setStatus("missing-id", "resolved")
    ).rejects.toThrow(AppError);
  });
});
