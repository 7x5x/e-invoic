import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import { invoiceRouter } from "./controller/invoice.js";
import { newEGSRouter } from "./controller/create_egs.js";
import dotenv from "dotenv";
import swaggerDoc from "./swaggerConfig.js";
import { verifyJWT } from "./middleware/verifyJWT.js";
import cors from "cors";
import { corsOptions } from "./config/corsOptions.js";
import { credentials } from "./middleware/credentials.js";
import createHttpError from "http-errors";

dotenv.config();
const app = express();
swaggerDoc(app);

app.use(credentials);
app.use(cors(corsOptions));
app.use(logger("dev"));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.post("/new_egs", verifyJWT, newEGSRouter);
app.post("/invoice", verifyJWT, invoiceRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(createHttpError(404));
});

app.use(verifyJWT);

export default app;
