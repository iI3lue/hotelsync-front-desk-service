import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { checkOutSchema } from "../validators/front-desk.js";

const router = Router();

const requireDesk = requireRole("RECEPTIONIST", "MANAGER", "SUPER_ADMIN");

router.post(
  "/",
  requireAuth,
  requireDesk,
  validate(checkOutSchema),
  frontDeskController.checkOut.bind(frontDeskController)
);

export default router;
