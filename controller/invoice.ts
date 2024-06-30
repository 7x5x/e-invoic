import { ZATCATaxInvoice } from "../src/zatca/templates/ZATCATaxInvoice.js";
import { EGS } from "../src/zatca/egs/index.js";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import fs from "fs";
import {
  ZATCATaxInvoiceSchema,
  ZATCATaxInvoiceSchemaType,
} from "./schema/invice_schemas.js";
import { removeChars } from "../lib/removeChars.js";

const statusMap = {
  pass: 1,
  warning: 2,
  error: 3,
};

export const invoiceRouter = async (req, res, next) => {
  const { error, value } = ZATCATaxInvoiceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
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

    return res.status(200).json(await main(value));
  } catch (error) { 
    return res.status(error.Statcode || 500).json(error);
  }
};

export const main = async (data: ZATCATaxInvoiceSchemaType) => {
  const issue_date = moment(new Date()).format("YYYY-MM-DD");
  const issue_time = moment(new Date()).format("HH:mm:ss");
  try {
    const invoice = new ZATCATaxInvoice({
      props: {
        ...data.props,
        issue_date,
        issue_time,
      },
    });

    const egs = new EGS({
      ...data.props.egs_info,
      ...data.productionData,
    });

    const { signed_invoice_string, invoice_hash, qr } = egs.signInvoice(
      invoice,
      true
    );

    const res = await egs.clearanceInvoice(signed_invoice_string, invoice_hash);

    const filename = removeChars(
      `${data.props.egs_info.CRN_number}_${issue_date}T${issue_time}_${data.props.invoice_counter_number}.xml`
    );
    const filePath = `invoices/${filename}`;
    fs.writeFile(filePath, signed_invoice_string, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("Successfully wrote data to file!");
      }
    });

    return { ...res, hash: invoice_hash };
  } catch (error: any) {
    throw error;
  }
};
