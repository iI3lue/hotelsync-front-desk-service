import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

export const arrivalsQuerySchema = z.object({
  hotel_id: z.string().uuid(),
  date: dateSchema,
});

export const checkInSchema = z.object({
  booking_id: z.string().uuid(),
  physical_room_number: z.string().min(1).max(20),
  // UUID externo del catalogo de Property (sin FK entre bases). Opcional:
  // recepcion puede seguir operando solo con el numero fisico.
  physical_room_id: z.string().uuid().optional(),
});

export const checkOutSchema = z.object({
  booking_id: z.string().uuid(),
});

export const assignmentBookingParamSchema = z.object({
  bookingId: z.string().uuid(),
});

export const createIncidentSchema = z.object({
  booking_id: z.string().uuid(),
  description: z.string().min(1),
});

export const listIncidentsQuerySchema = z.object({
  booking_id: z.string().uuid().optional(),
});

export const incidentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const updateIncidentSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

export type ArrivalsQuery = z.infer<typeof arrivalsQuerySchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
