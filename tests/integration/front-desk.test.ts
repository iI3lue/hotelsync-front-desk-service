import request from "supertest";
import express from "express";
import arrivalsRouter from "../../src/routes/arrivals.js";
import checkInRouter from "../../src/routes/check-in.js";
import checkOutRouter from "../../src/routes/check-out.js";
import incidentsRouter from "../../src/routes/incidents.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

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
import { signAccessToken } from "../helpers/tokens.js";

const mockPrisma = prisma as any;
const mockFetchBooking = fetchBooking as jest.Mock;
const mockFetchConfirmed = fetchConfirmedBookings as jest.Mock;

// $transaction interactiva: passthrough al mismo mock (tx === prisma mockeado)
mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

const app = express();
app.use(express.json());

// Health check route (mirrors index.ts)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "front-desk-service",
  });
});

app.use("/v1/arrivals", arrivalsRouter);
app.use("/v1/check-in", checkInRouter);
app.use("/v1/check-out", checkOutRouter);
app.use("/v1/incidents", incidentsRouter);
app.use(errorHandler);

const BOOKING_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const HOTEL_ID = "c1b2c3d4-e5f6-4890-abcd-ef1234567890";

const STAFF_TOKEN = signAccessToken({
  sub: "11111111-2222-4333-8444-555555555555",
  email: "recep@example.com",
  email_verified: true,
  role: "RECEPTIONIST",
  hotel_id: HOTEL_ID,
});

describe("Front Desk Service API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /v1/arrivals", () => {
    it("should return arrivals for hotel and date from the local read model", async () => {
      mockPrisma.arrival.findMany.mockResolvedValue([
        { booking_id: BOOKING_ID, status: "confirmed" },
      ]);

      const res = await request(app).get(
        `/v1/arrivals?hotel_id=${HOTEL_ID}&date=2026-10-02`
      ).set("Authorization", `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(mockFetchConfirmed).not.toHaveBeenCalled();
    });

    it("should return 400 with missing params", async () => {
      const res = await request(app)
        .get("/v1/arrivals")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/check-in", () => {
    it("should check in a confirmed booking with staff session", async () => {
      mockFetchBooking.mockResolvedValue({
        booking_id: BOOKING_ID,
        hotel_id: HOTEL_ID,
        status: "confirmed",
      });
      mockPrisma.roomAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.roomAssignment.create.mockResolvedValue({
        booking_id: BOOKING_ID,
        physical_room_number: "101",
      });

      const res = await request(app)
        .post("/v1/check-in")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`)
        .send({ booking_id: BOOKING_ID, physical_room_number: "101" });

      expect(res.status).toBe(201);
    });

    it("should return 401 without a session", async () => {
      const res = await request(app)
        .post("/v1/check-in")
        .send({ booking_id: BOOKING_ID, physical_room_number: "101" });

      expect(res.status).toBe(401);
    });

    it("should return 409 for a non-confirmed booking", async () => {
      mockFetchBooking.mockResolvedValue({
        booking_id: BOOKING_ID,
        hotel_id: HOTEL_ID,
        status: "pending",
      });

      const res = await request(app)
        .post("/v1/check-in")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`)
        .send({ booking_id: BOOKING_ID, physical_room_number: "101" });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /v1/check-out", () => {
    it("should check out an active stay with staff session", async () => {
      mockFetchBooking.mockResolvedValue({
        booking_id: BOOKING_ID,
        hotel_id: HOTEL_ID,
        status: "confirmed",
      });
      mockPrisma.roomAssignment.findUnique.mockResolvedValue({
        booking_id: BOOKING_ID,
        checked_out_at: null,
      });
      mockPrisma.roomAssignment.update.mockResolvedValue({
        booking_id: BOOKING_ID,
        checked_out_at: new Date().toISOString(),
      });

      const res = await request(app)
        .post("/v1/check-out")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`)
        .send({ booking_id: BOOKING_ID });

      expect(res.status).toBe(200);
    });

    it("should return 404 without an active check-in", async () => {
      mockFetchBooking.mockResolvedValue({
        booking_id: BOOKING_ID,
        hotel_id: HOTEL_ID,
        status: "confirmed",
      });
      mockPrisma.roomAssignment.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/v1/check-out")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`)
        .send({ booking_id: BOOKING_ID });

      expect(res.status).toBe(404);
    });
  });

  describe("Incidents", () => {
    it("POST /v1/incidents should create an incident", async () => {
      mockFetchBooking.mockResolvedValue({
        booking_id: BOOKING_ID,
        hotel_id: HOTEL_ID,
      });
      mockPrisma.guestIncident.create.mockResolvedValue({
        incident_id: "i1",
        status: "open",
      });

      const res = await request(app)
        .post("/v1/incidents")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`)
        .send({ booking_id: BOOKING_ID, description: "Canilla goteando" });

      expect(res.status).toBe(201);
    });

    it("GET /v1/incidents should list incidents", async () => {
      mockPrisma.guestIncident.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/v1/incidents")
        .set("Authorization", `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
