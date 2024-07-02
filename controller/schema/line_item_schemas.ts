import Joi from "joi";
import {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceLineItemDiscount,
} from "../../src/zatca/templates/tax_invoice_template.js";

export const ZATCAInvoiceLineItemDiscountSchema =
  Joi.object<ZATCAInvoiceLineItemDiscount>({
    amount: Joi.number().required(),
    reason: Joi.string().required(),
  });

export const ZATCAInvoiceLineItemSchema = Joi.object<ZATCAInvoiceLineItem>({
  id: Joi.number().required(),
  name: Joi.string().required(),
  notes: Joi.array(),
  quantity: Joi.number().required(),
  Penalty: Joi.array().items(ZATCAInvoiceLineItemDiscountSchema),
  tax_exclusive_price: Joi.number().required(),
  discount: ZATCAInvoiceLineItemDiscountSchema,
  VAT_percent: Joi.number(),
});

export default ZATCAInvoiceLineItemSchema;
