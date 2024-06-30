import Joi from "joi";
import {
  CustomerLocation,
  ZatcaCustomerInfo,
} from "../../src/zatca/templates/tax_invoice_template.js";

export const CustomerLocationSchema = Joi.object<CustomerLocation>({
  Street: Joi.string().required(),
  BuildingNumber: Joi.string().required(),
  PlotIdentification: Joi.string().required(),
  CitySubdivisionName: Joi.string().required(),
  CityName: Joi.string().required(),
  PostalZone: Joi.string().required(),
});

export const ZatcaCustomerInfoSchema = Joi.object<ZatcaCustomerInfo>({
  NAT_number: Joi.string().required(),
  location: CustomerLocationSchema,
  PartyTaxScheme: Joi.string().required(),
  RegistrationName: Joi.string().required(),
});

export default ZatcaCustomerInfoSchema;
