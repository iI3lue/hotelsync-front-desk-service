import { Router } from "express";
import { frontDeskController } from "../controllers/front-desk.controller.js";
import { validate } from "../middleware/validate.js";
import { checkOutSchema } from "../validators/front-desk.js";

const router = Router();

router.post(
  "/",
  validate(checkOutSchema),
  frontDeskController.checkOut.bind(frontDeskController)
);

export default router;
