import Joi from "joi";
import {
  CustomerLocation,
  ZatcaCustomerInfo,
  productionData,
} from "../../src/zatca/templates/tax_invoice_template.js";

export const productionDataSchema = Joi.object<productionData>({
  private_key: Joi.string().required(),
  production_certificate: Joi.string().required(),
  production_api_secret: Joi.string().required(),
  request_id: Joi.string(),
});
 
