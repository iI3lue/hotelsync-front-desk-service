import { Router } from "express";
import { incidentController } from "../controllers/front-desk.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createIncidentSchema,
  incidentIdParamSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema,
} from "../validators/front-desk.js";

const router = Router();

router.get(
  "/",
  validate(listIncidentsQuerySchema, "query"),
  incidentController.list.bind(incidentController)
);
router.post(
  "/",
  validate(createIncidentSchema),
  incidentController.create.bind(incidentController)
);
router.patch(
  "/:id",
  validate(incidentIdParamSchema, "params"),
  validate(updateIncidentSchema),
  incidentController.setStatus.bind(incidentController)
);

export default router;
