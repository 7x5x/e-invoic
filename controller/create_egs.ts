import {
  DocumentCurrencyCode,
  ZatcaCustomerInfo,
} from "../src/zatca/templates/tax_invoice_template.js";
import { EGS } from "../src/zatca/egs/index.js";
import {
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
  ZATCATaxInvoice,
} from "../src/zatca/templates/ZATCATaxInvoice.js";
import moment from "moment";
import { EGSUnitSchema, egs_unit } from "./schema/EGSUnit_info_schema.js";
import { v4 as uuidv4 } from "uuid";

/* GET home page. */
export const newEGSRouter = async (req, res) => {
  const { error, value } = EGSUnitSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const egs_unit: egs_unit = value;
  try {
    return res.status(200).json(await new_egs(egs_unit));
  } catch (error) {
    return res.status(error.Statcode || 500).json(error);
  }
};

const currentDate = new Date();
const futureDate = moment(currentDate).add(5, "days");

const tempInvoice: any = {
  invoice_counter_number: 1,
  invoice_serial_number: "EGS1-886431145-1",
  documentCurrencyCode: DocumentCurrencyCode.SAR,
  payment_method: ZATCAPaymentMethods.CASH,
  issue_date: moment(new Date()).format("YYYY-MM-DD"),
  delivery_date: futureDate.format("YYYY-MM-DD"),
  issue_time: moment(new Date()).format("HH:mm:ss"),
  previous_invoice_hash:
    "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
  line_items: [
    {
      id: 1,
      name: "TEST NAME",
      note: "Test To Create New EGS",
      quantity: 1,
      tax_exclusive_price: 1000,
      VAT_percent: 0.15,
    },
  ],
};

const customer: ZatcaCustomerInfo = {
  NAT_number: "311111111111113",
  // PartyTaxScheme: "strings11111111111",
  RegistrationName: "Acme Widget’s LTD 2",
  location: {
    Street: "الرياض",
    BuildingNumber: 1111,
    PlotIdentification: 2223,
    CitySubdivisionName: "الرياض",
    CityName: "الدمام | Dammam",
    PostalZone: 12222,
  },
};

const new_egs = async (data: egs_unit) => {
  data.egs_unit.uuid = uuidv4();
  const invoice = new ZATCATaxInvoice({
    props: {
      customerInfo: customer,
      egs_info: data.egs_unit,
      ...tempInvoice,
    },
  });
  const debit_not = new ZATCATaxInvoice({
    props: {
      customerInfo: customer,
      egs_info: data.egs_unit,
      ...tempInvoice,
      cancelation: {
        canceled_invoice_number: 1,
        reason: "CANCELLATION_OR_TERMINATION",
        cancelation_type: ZATCAInvoiceTypes.DEBIT_NOTE,
      },
    },
  });
  const credit_note = new ZATCATaxInvoice({
    props: {
      customerInfo: customer,
      egs_info: data.egs_unit,
      ...tempInvoice,
      cancelation: {
        canceled_invoice_number: 1,
        reason: "CANCELLATION_OR_TERMINATION",
        cancelation_type: ZATCAInvoiceTypes.CREDIT_NOTE,
      },
    },
  });

  const invoices: any[] = [invoice, debit_not, credit_note];

  try {
    let compliance_request_id: any;
    const egs = new EGS(data.egs_unit);

    const private_key = await egs.generateNewKeysAndCSR(
      false,
      data.device_name
    );

    compliance_request_id = await egs.issueComplianceCertificate(data.otp);

    for (const invoice of invoices) {
      const { signed_invoice_string, invoice_hash } = egs.signInvoice(invoice);
      await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
    }

    const productionData = {
      productionData: await egs.issueProductionCertificate(
        compliance_request_id
      ),
      private_key: Buffer.from(private_key).toString("base64"),
    };

    return productionData;
  } catch (error: any) {
    throw error;
  }
};
