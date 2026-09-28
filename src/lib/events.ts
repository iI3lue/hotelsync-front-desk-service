/**
 * Eventos publicados por Front Desk (documento de arquitectura §4.5).
 *
 * `checkout.completed` lo consumen Housekeeping (tarea de limpieza) y
 * Billing (cierre de folio) vía RabbitMQ.
 * `booking.completed` lo consumirá Loyalty (acumulación de puntos) y se
 * publica en la misma transacción del check-out.
 */
export type FrontDeskEventType = "checkout.completed" | "booking.completed";

export function publishEvent(
  type: FrontDeskEventType,
  payload: { booking_id: string; [key: string]: unknown }
): void {
  console.log(`[events] ${type} booking_id=${payload.booking_id}`, payload);
}
