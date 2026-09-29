import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";
import { enqueueOutboxEvent } from "../lib/outbox.js";
import { fetchBooking } from "../lib/booking-client.js";
import {
  ArrivalsQuery,
  CheckInInput,
  CheckOutInput,
  CreateIncidentInput,
} from "../validators/front-desk.js";

export class FrontDeskService {
  /**
   * Llegadas del día: reservas `confirmed` del hotel que cubren la fecha.
   *
   * Lee el read model local (`arrivals`), proyectado desde
   * `booking.created` / `booking.cancelled` vía RabbitMQ (fuente §6,
   * comunicación asíncrona garantizada con outbox).
   */
  async getArrivals(query: ArrivalsQuery) {
    const date = new Date(query.date);
    return prisma.arrival.findMany({
      where: {
        hotel_id: query.hotel_id,
        status: "confirmed",
        check_in: { lte: date },
        check_out: { gte: date },
      },
      orderBy: { check_in: "asc" },
    });
  }

  /** Asignación de habitación de una reserva (404 si no tiene check-in). */
  async getAssignment(bookingId: string) {
    const assignment = await prisma.roomAssignment.findUnique({
      where: { booking_id: bookingId },
    });

    if (!assignment) {
      throw new AppError(
        404,
        `No check-in found for booking ${bookingId}`,
        "Not Found"
      );
    }

    return assignment;
  }

  async checkIn(data: CheckInInput) {
    const booking = await fetchBooking(data.booking_id);

    if (!booking) {
      throw new AppError(
        404,
        `Booking with id ${data.booking_id} not found in Booking Service`,
        "Not Found"
      );
    }

    if (booking.status !== "confirmed") {
      throw new AppError(
        409,
        `Cannot check-in booking with status ${booking.status}`,
        "Conflict"
      );
    }

    const existing = await prisma.roomAssignment.findUnique({
      where: { booking_id: data.booking_id },
    });

    if (existing) {
      throw new AppError(
        409,
        `Booking ${data.booking_id} is already checked in`,
        "Conflict"
      );
    }

    return prisma.roomAssignment.create({
      data: {
        booking_id: data.booking_id,
        physical_room_number: data.physical_room_number,
      },
    });
  }

  async checkOut(data: CheckOutInput) {
    const assignment = await prisma.roomAssignment.findUnique({
      where: { booking_id: data.booking_id },
    });

    if (!assignment) {
      throw new AppError(
        404,
        `No check-in found for booking ${data.booking_id}`,
        "Not Found"
      );
    }

    if (assignment.checked_out_at) {
      throw new AppError(
        409,
        `Booking ${data.booking_id} is already checked out`,
        "Conflict"
      );
    }

    // Outbox transaccional: cierre + eventos se confirman juntos.
    // El dispatcher publica `checkout.completed` (Housekeeping, Billing) y
    // `booking.completed` (Loyalty a futuro) a RabbitMQ con confirm
    // (documento de arquitectura §4.5, tabla de eventos §5.11).
    // La llegada sale de la lista en el mismo acto: ya no es `confirmed`.
    const closed = await prisma.$transaction(async (tx) => {
      const updated = await tx.roomAssignment.update({
        where: { booking_id: data.booking_id },
        data: { checked_out_at: new Date() },
      });

      await tx.arrival.updateMany({
        where: { booking_id: data.booking_id },
        data: { status: "checked_out" },
      });

      await enqueueOutboxEvent(tx, "checkout.completed", {
        booking_id: updated.booking_id,
        physical_room_number: updated.physical_room_number,
      });

      await enqueueOutboxEvent(tx, "booking.completed", {
        booking_id: updated.booking_id,
        physical_room_number: updated.physical_room_number,
      });

      return updated;
    });

    return closed;
  }
}

export class IncidentService {
  async create(data: CreateIncidentInput) {
    return prisma.guestIncident.create({
      data: {
        booking_id: data.booking_id,
        description: data.description,
      },
    });
  }

  async list(bookingId?: string) {
    return prisma.guestIncident.findMany({
      where: bookingId ? { booking_id: bookingId } : {},
      orderBy: { created_at: "desc" },
    });
  }

  async setStatus(id: string, status: string) {
    const existing = await prisma.guestIncident.findUnique({
      where: { incident_id: id },
    });

    if (!existing) {
      throw new AppError(
        404,
        `Incident with id ${id} not found`,
        "Not Found"
      );
    }

    return prisma.guestIncident.update({
      where: { incident_id: id },
      data: { status },
    });
  }
}

export const frontDeskService = new FrontDeskService();
export const incidentService = new IncidentService();
