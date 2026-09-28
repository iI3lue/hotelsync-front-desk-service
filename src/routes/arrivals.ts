import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { validate } from "../middleware/validate.js";
import { arrivalsQuerySchema } from "../validators/front-desk.js";

const router = Router();

router.get(
  "/",
  validate(arrivalsQuerySchema, "query"),
  frontDeskController.arrivals.bind(frontDeskController)
);

export default router;
