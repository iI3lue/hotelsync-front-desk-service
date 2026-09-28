import prisma from "./prisma.js";
import { broker } from "./broker.js";
import type { FrontDeskEventType } from "./events.js";

export interface OutboxPayload {
  booking_id: string;
  [key: string]: unknown;
}

/**
 * Encola un evento en el outbox DENTRO de la transacción del llamador.
 * Check-out + evento se confirman juntos (rollback conjunto).
 */
export async function enqueueOutboxEvent(
  tx: {
    eventOutbox: {
      create: (args: {
        data: { event_type: string; payload: object };
      }) => Promise<unknown>;
    };
  },
  eventType: FrontDeskEventType,
  payload: OutboxPayload
): Promise<void> {
  await tx.eventOutbox.create({
    data: { event_type: eventType, payload },
  });
}

/**
 * Dispatcher del outbox: publica con confirm y marca `sent` solo tras
 * el confirm. Si el broker cae, las filas quedan `pending` y se reintentan.
 */
export function createOutboxDispatcher() {
  return broker.createDispatcher(
    async () => {
      const rows = await prisma.eventOutbox.findMany({
        where: { status: "pending" },
        orderBy: { created_at: "asc" },
        take: 100,
      });
      return rows.map((r) => ({
        event_id: r.event_id,
        event_type: r.event_type,
        payload: r.payload as unknown,
      }));
    },
    async (eventId: string) => {
      await prisma.eventOutbox.update({
        where: { event_id: eventId },
        data: { status: "sent", sent_at: new Date() },
      });
    }
  );
}

/**
 * Arranca el drenaje periódico del outbox. Llamar una sola vez en index.ts
 * (fuera de tests y solo cuando hay RABBITMQ_URL configurado).
 */
export function startOutboxDispatcher(intervalMs = 10000): NodeJS.Timeout {
  const dispatcher = createOutboxDispatcher();
  return broker.startDispatcher(() => dispatcher.flush(), intervalMs);
}
