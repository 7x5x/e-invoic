import Joi from "joi";
import ZatcaCustomerInfoSchema from "./customer_schema.js";
import { EGSLocationSchema } from "./EGSUnit_info_schema.js";
import ZATCAInvoiceLineItemSchema, {
  ZATCAInvoiceLineItemDiscountSchema,
} from "./line_item_schemas.js";
import {
  DocumentCurrencyCode,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
  ZATCAInvoiceProps,
  productionData,
} from "../../src/zatca/templates/tax_invoice_template.js";
import { productionDataSchema } from "./production_schema.js";
import { EGSUnitInfo } from "../../src/zatca/egs/index.js";

export type ZATCATaxInvoiceSchemaType = {
  props: ZATCAInvoiceProps;
  productionData: productionData;
};

const Supplier = Joi.object<EGSUnitInfo>({
  CRN_number: Joi.string().required(),
  VAT_name: Joi.string().required(),
  VAT_number: Joi.string().required(),
  location: EGSLocationSchema.required(),
});
const ZATCATaxInvoicePropsSchema = Joi.object<ZATCAInvoiceProps>({
  invoice_counter_number: Joi.number().required(),
  conversion_rate: Joi.number().required(),
  invoice_serial_number: Joi.string().required(),
  delivery_date: Joi.string().required(),
  invoice_level_note: Joi.string(),
  invoice_level_discount: ZATCAInvoiceLineItemDiscountSchema,
  cancelation: Joi.object({
    canceled_invoice_number: Joi.number().required(),
    reason: Joi.string().required(),
    cancelation_type: Joi.string()
      .valid(...Object.values(ZATCAInvoiceTypes))
      .required(),
  }).optional(),
  egs_info: Supplier.required(),
  
  customerInfo: ZatcaCustomerInfoSchema.required(),
  documentCurrencyCode: Joi.string()
    .valid(...Object.values(DocumentCurrencyCode))
    .required(),
  payment_method: Joi.string()
    .valid(...Object.values(ZATCAPaymentMethods))
    .required(),
  previous_invoice_hash: Joi.string().required(),
  line_items: Joi.array().items(ZATCAInvoiceLineItemSchema).required(),
});

export const ZATCATaxInvoiceSchema = Joi.object<ZATCATaxInvoiceSchemaType>({
  props: ZATCATaxInvoicePropsSchema.required(),
  productionData: productionDataSchema.required(),
});
