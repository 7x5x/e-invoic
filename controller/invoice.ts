import { ZATCATaxInvoice } from "../src/zatca/templates/ZATCATaxInvoice.js";
import { Request, Response, NextFunction } from "express";
import { EGS } from "../src/zatca/egs/index.js";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import {
  ZATCATaxInvoiceSchema,
  ZATCATaxInvoiceSchemaType,
} from "./schema/invice_schemas.js";
import { saveInvoice } from "../lib/removeChars.js";

export const invoiceRouter = async (req: Request, res: Response) => {
  const { error, value } = ZATCATaxInvoiceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const issue_date = moment(new Date()).format("YYYY-MM-DD");
  const issue_time = moment(new Date()).format("HH:mm:ss");

  value.props.issue_date = issue_date;
  value.props.issue_time = issue_time;

  const filename = `${value.props.egs_info.CRN_number}_${issue_date}T${issue_time}_${value.props.invoice_counter_number}.xml`;

  try {
    value.props.egs_info.uuid = uuidv4();

    value.productionData.private_key = Buffer.from(
      value.productionData.private_key,
      "base64"
    ).toString();

    value.productionData.production_certificate = Buffer.from(
      value.productionData.production_certificate,
      "base64"
    ).toString();
    const result = await main(value);
    saveInvoice(filename, result.clearedInvoice);
    return res.status(200).json(result);
  } catch (error) {
    error.Statcode === 202 && saveInvoice(filename, error.clearedInvoice);
    return res
      .status(error.Statcode || 500)
      .json({ ...error, invoiceID: value.props.invoice_serial_number });
  }
};

export const main = async (data: ZATCATaxInvoiceSchemaType) => {
  let signed_invoice_string, invoice_hash, qr;

  try {
    const invoice = new ZATCATaxInvoice({ props: { ...data.props } });

    const egs = new EGS({
      ...data.props.egs_info,
      ...data.productionData,
    });

    ({ signed_invoice_string, invoice_hash, qr } = egs.signInvoice(
      invoice,
      true
    ));

    const res = await egs.clearanceInvoice(signed_invoice_string, invoice_hash);

    return {
      ...res,
      hash: invoice_hash,
      qr,
      invoiceID: data.props.invoice_serial_number,
    };
  } catch (error: any) {
    throw { ...error, qr, hash: invoice_hash };
  }
};
