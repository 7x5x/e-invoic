import { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
config();

export const verifyJWT = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(" ")[1];

  if (token !== process.env.ACCESS_TOKEN_SECRET) return res.sendStatus(403);
  next();
};
