import prisma from "./prisma.js";
import { consume, ARRIVALS_QUEUE } from "./broker.js";

export interface BookingCreatedPayload {
  booking_id: string;
  guest_id: string;
  guest_name?: string | null;
  hotel_id: string;
  room_type_id: string;
  check_in: string;
  check_out: string;
  channel?: string;
}

export interface BookingCancelledPayload {
  booking_id: string;
  hotel_id?: string;
  room_type_id?: string;
}

type PrismaLike = typeof prisma;

/**
 * Aplica booking.confirmed/cancelled al read model operativo de llegadas.
 * Idempotente: `booking_id` es PK, los replays del broker hacen upsert
 * (redelivery con el mismo payload deja el mismo estado).
 */
export async function handleBookingEvent(
  db: PrismaLike,
  routingKey: string,
  payload: BookingCreatedPayload & BookingCancelledPayload
): Promise<void> {
  // booking.created solo significa pending; no debe aparecer en Llegadas.
  if (routingKey === "booking.created") return;

  if (routingKey === "booking.confirmed") {
    const created = payload as BookingCreatedPayload;
    await db.arrival.upsert({
      where: { booking_id: created.booking_id },
      create: {
        booking_id: created.booking_id,
        guest_id: created.guest_id,
        guest_name: created.guest_name ?? null,
        hotel_id: created.hotel_id,
        room_type_id: created.room_type_id,
        check_in: new Date(created.check_in),
        check_out: new Date(created.check_out),
        channel: created.channel ?? "direct",
        status: "confirmed",
      },
      update: {
        guest_id: created.guest_id,
        guest_name: created.guest_name ?? null,
        hotel_id: created.hotel_id,
        room_type_id: created.room_type_id,
        check_in: new Date(created.check_in),
        check_out: new Date(created.check_out),
        channel: created.channel ?? "direct",
        status: "confirmed",
      },
    });
    return;
  }

  if (routingKey === "booking.cancelled") {
    // Idempotente y sin filas basura: si el created aún no llegó (reorden),
    // no hay nada que cancelar (no-op); el created posterior deja la fila
    // en `confirmed` solo si la reserva sigue vigente del lado de Booking.
    await db.arrival.updateMany({
      where: { booking_id: payload.booking_id },
      data: { status: "cancelled" },
    });
    return;
  }

  console.warn(`[consumer] routing key ignorada: ${routingKey}`);
}

/**
 * Arranca el consumidor de llegadas: cola durable `front-desk.arrivals`
 * bindeada a confirmaciones y cancelaciones canónicas.
 */
export async function startConsumer(): Promise<void> {
  await consume(
    ARRIVALS_QUEUE,
    ["booking.confirmed", "booking.cancelled"],
    (routingKey, payload) => handleBookingEvent(prisma, routingKey, payload)
  );
}
