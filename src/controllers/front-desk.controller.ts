import { Request, Response, NextFunction } from "express";
import {
  frontDeskService,
  incidentService,
} from "../services/front-desk.service.js";

export class FrontDeskController {
  async arrivals(req: Request, res: Response, next: NextFunction) {
    try {
      const arrivals = await frontDeskService.getArrivals(req.query as never);
      res.json(arrivals);
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await frontDeskService.checkIn(req.body);
      res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  }

  async getAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await frontDeskService.getAssignment(
        req.params.bookingId as string
      );
      res.json(assignment);
    } catch (err) {
      next(err);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await frontDeskService.checkOut(req.body);
      res.json(assignment);
    } catch (err) {
      next(err);
    }
  }
}

export class IncidentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { booking_id } = req.query as { booking_id?: string };
      const incidents = await incidentService.list(booking_id);
      res.json(incidents);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await incidentService.create(req.body);
      res.status(201).json(incident);
    } catch (err) {
      next(err);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const incident = await incidentService.setStatus(id, req.body.status);
      res.json(incident);
    } catch (err) {
      next(err);
    }
  }
}

export const frontDeskController = new FrontDeskController();
export const incidentController = new IncidentController();
