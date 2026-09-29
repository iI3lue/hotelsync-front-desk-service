import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { validate } from "../middleware/validate.js";
import { checkInSchema, assignmentBookingParamSchema } from "../validators/front-desk.js";

const router = Router();

router.post(
  "/",
  validate(checkInSchema),
  frontDeskController.checkIn.bind(frontDeskController)
);

router.get(
  "/:bookingId",
  validate(assignmentBookingParamSchema, "params"),
  frontDeskController.getAssignment.bind(frontDeskController)
);

export default router;
