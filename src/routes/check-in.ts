import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { validate } from "../middleware/validate.js";
import { checkInSchema } from "../validators/front-desk.js";

const router = Router();

router.post(
  "/",
  validate(checkInSchema),
  frontDeskController.checkIn.bind(frontDeskController)
);

export default router;
