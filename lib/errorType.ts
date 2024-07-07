import { log } from "../src/logger/index.js";

export const throwErrorObject = (errorObject: any, log: boolean = true): never => {
  log && logError(errorObject);
  throw errorObject;
};

export const logError = (errorObject: any): void => {
  const { Statcode, message } = errorObject;
  const level = Statcode === 202 ? "Warning" : "Error";
  log(
    level,
    "clearanceInvoice ",
    ` ${Statcode || 500} : ${message || level}` || "An error occurred"
  );
};
