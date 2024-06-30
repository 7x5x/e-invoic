import Joi from "joi";
import { EGSUnitInfo, EGSUnitLocation } from "../../src/zatca/egs/index.js";

export type egs_unit = {
  egs_unit: EGSUnitInfo;
  otp: string;
  device_name: string;
};

const EGSLocationSchema = Joi.object<EGSUnitLocation>({
  city: Joi.string().required(),
  city_subdivision: Joi.string().required(),
  street: Joi.string().required(),
  plot_identification: Joi.string().required(),
  building: Joi.string().required(),
  postal_zone: Joi.string().required(),
});

const EGSUnitInfoSchema = Joi.object<EGSUnitInfo>({
  model: Joi.string().required(),
  custom_id: Joi.string().required(),
  CRN_number: Joi.string().required(),
  VAT_name: Joi.string().required(),
  VAT_number: Joi.string().required(),
  location: EGSLocationSchema,
  branch_name: Joi.string().required(),
  branch_industry: Joi.string().required(),
});
const EGSUnitSchema = Joi.object<egs_unit>({
  egs_unit: EGSUnitInfoSchema.required(),
  otp: Joi.string().required(),
  device_name: Joi.string().required(),
});

export { EGSUnitInfoSchema, EGSUnitSchema,EGSLocationSchema };
