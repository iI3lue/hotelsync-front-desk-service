import { Router } from "express";
import { incidentController } from "../controllers/front-desk.controller.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createIncidentSchema,
  incidentIdParamSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema,
} from "../validators/front-desk.js";

const router = Router();
const requireDesk = requireRole("RECEPTIONIST", "MANAGER", "SUPER_ADMIN");

router.get(
  "/",
  requireAuth,
  requireDesk,
  validate(listIncidentsQuerySchema, "query"),
  incidentController.list.bind(incidentController)
);
router.post(
  "/",
  requireAuth,
  requireDesk,
  validate(createIncidentSchema),
  incidentController.create.bind(incidentController)
);
router.patch(
  "/:id",
  requireAuth,
  requireDesk,
  validate(incidentIdParamSchema, "params"),
  validate(updateIncidentSchema),
  incidentController.setStatus.bind(incidentController)
);

export default router;
