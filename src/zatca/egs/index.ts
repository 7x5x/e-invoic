/**
 * This module requires OpenSSL to be installed on the system.
 * Using an OpenSSL In order to generate secp256k1 key pairs, a CSR and sign it.
 * I was unable to find a working library that supports the named curve `secp256k1` and do not want to implement my own JS based crypto.
 * Any crypto expert contributions to move away from OpenSSL to JS will be appreciated.
 */

import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

import API from "../api/index.js";
import { ZATCATaxInvoice } from "../templates/ZATCATaxInvoice.js";
import defaultCSRConfig from "../templates/csr_template.js";

import { throwErrorObject } from "../../../lib/errorType.js";

export interface EGSUnitLocation {
  city: string;
  city_subdivision: string;
  street: string;
  plot_identification: number;
  building: number;
  postal_zone: number;
}

export interface EGSUnitInfo {
  uuid: string;
  custom_id: string;
  model: string;
  CRN_number: string;
  VAT_name: string;
  VAT_number: string;
  branch_name: string;
  branch_industry: string;
  location: EGSUnitLocation;
  private_key?: string;
  csr?: string;
  compliance_certificate?: string;
  compliance_api_secret?: string;
  production_certificate?: string;
  production_api_secret?: string;
}

const OpenSSL = (cmd: string[]): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const command = spawn("openssl", cmd);
      let result = "";
      command.stdout.on("data", (data) => {
        result += data.toString();
      });
      command.on("close", (code: number) => {
        return resolve(result);
      });
      command.on("error", (error: any) => {
        return reject(error);
      });
    } catch (error: any) {
      reject(error);
    }
  });
};

// Generate a secp256k1 key pair
const generateSecp256k1KeyPair = async (): Promise<string> => {
  try {
    const result = await OpenSSL(["ecparam", "-name", "secp256k1", "-genkey"]);
    if (!result.includes("-----BEGIN EC PRIVATE KEY-----"))
      throw new Error("Error no private key found in OpenSSL output.");

    let private_key: string = `-----BEGIN EC PRIVATE KEY-----${
      result.split("-----BEGIN EC PRIVATE KEY-----")[1]
    }`.trim();
    return private_key;
  } catch (error) {
    throw error;
  }
};

// Generate a signed ecdsaWithSHA256 CSR
const generateCSR = async (
  egs_info: EGSUnitInfo,
  production: boolean,
  solution_name: string
): Promise<string> => {
  if (!egs_info.private_key)
    throwErrorObject({
      message: "EGS has no private key",
    });

  // This creates a temporary private file, and csr config file to pass to OpenSSL in order to create and sign the CSR.
  const private_key_file = `${process.env.TEMP_FOLDER ?? ""}${uuidv4()}.pem`;
  const csr_config_file = `${process.env.TEMP_FOLDER ?? ""}${uuidv4()}.cnf`;

  fs.writeFileSync(private_key_file, egs_info.private_key);
  fs.writeFileSync(
    csr_config_file,
    defaultCSRConfig({
      egs_model: egs_info.model,
      egs_serial_number: egs_info.uuid,
      solution_name: solution_name,
      vat_number: egs_info.VAT_number,
      branch_location: `${egs_info.location.building} ${egs_info.location.street}, ${egs_info.location.city}`,
      branch_industry: egs_info.branch_industry,
      branch_name: egs_info.branch_name,
      taxpayer_name: egs_info.VAT_name,
      taxpayer_provided_id: egs_info.custom_id,
      production: production,
    })
  );

  const cleanUp = () => {
    fs.unlink(private_key_file, () => {});
    fs.unlink(csr_config_file, () => {});
  };

  try {
    const result = await OpenSSL([
      "req",
      "-new",
      "-sha256",
      "-key",
      private_key_file,
      "-config",
      csr_config_file,
    ]);
    if (!result.includes("-----BEGIN CERTIFICATE REQUEST-----"))
      throwErrorObject({
        csr_config_file: csr_config_file,
        result: result,
        message: "Error no CSR found in OpenSSL output.",
      });

    let csr: string = `-----BEGIN CERTIFICATE REQUEST-----${
      result.split("-----BEGIN CERTIFICATE REQUEST-----")[1]
    }`.trim();
    cleanUp();
    return csr;
  } catch (error) {
    cleanUp();
    throw error;
  }
};

export class EGS {
  private egs_info: EGSUnitInfo;
  private api: API;

  constructor(egs_info: EGSUnitInfo) {
    this.egs_info = egs_info;
    this.api = new API();
  }

  get() {
    return this.egs_info;
  }

  /* Sets/Updates an EGS info field.*/
  set(egs_info: Partial<EGSUnitInfo>) {
    this.egs_info = { ...this.egs_info, ...egs_info };
  }

  /**
   * Generates a new secp256k1 Public/Private key pair for the EGS.
   * Also generates and signs a new CSR.*/
  async generateNewKeysAndCSR(
    production: boolean,
    solution_name: string
  ): Promise<any> {
    try {
      const new_private_key = await generateSecp256k1KeyPair();
      this.egs_info.private_key = new_private_key;

      const new_csr = await generateCSR(
        this.egs_info,
        production,
        solution_name
      );

      this.egs_info.csr = new_csr;

      return new_private_key;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generates a new compliance certificate through ZATCA API.*/
  async issueComplianceCertificate(OTP: string): Promise<string> {
    if (!this.egs_info.csr)
      throwErrorObject({
        message: " EGS needs to generate a CSR first",
      });
    //error
    const issued_data = await this.api
      .compliance()
      .issueCertificate(this.egs_info.csr, OTP);
    this.egs_info.compliance_certificate = issued_data.issued_certificate;
    this.egs_info.compliance_api_secret = issued_data.api_secret;

    return issued_data.request_id;
  }

  /**
   * Generates a new production certificate through ZATCA API.*/
  async issueProductionCertificate(
    compliance_request_id: string
  ): Promise<any> {
    if (
      !this.egs_info.compliance_certificate ||
      !this.egs_info.compliance_api_secret
    )
      throwErrorObject({
        message:
          "EGS is missing a certificate/private key/api secret to request a production certificate.",
      });

    const issued_data = await this.api
      .production(
        this.egs_info.compliance_certificate,
        this.egs_info.compliance_api_secret
      )
      .issueCertificate(compliance_request_id);
    this.egs_info.production_certificate = issued_data.issued_certificate;
    this.egs_info.production_api_secret = issued_data.api_secret;
    return issued_data;
  }

  async checkInvoiceCompliance(
    signed_invoice_string: string,
    invoice_hash: string
  ): Promise<any> {
    if (
      !this.egs_info.compliance_certificate ||
      !this.egs_info.compliance_api_secret
    )
      throwErrorObject({
        message:
          "EGS is missing a certificate/private key/api secret to check the invoice compliance.",
      });

    return await this.api
      .compliance(
        this.egs_info.compliance_certificate,
        this.egs_info.compliance_api_secret
      )
      .checkInvoiceCompliance(
        signed_invoice_string,
        invoice_hash,
        this.egs_info.uuid
      );
  }

  /*Reports invoice with ZATCA API.*/
  async clearanceInvoice(
    signed_invoice_string: string,
    invoice_hash: string
  ): Promise<any> {
    if (
      !this.egs_info.production_certificate ||
      !this.egs_info.production_api_secret
    )
      throwErrorObject({
        message:
          "EGS is missing a certificate/private key/api secret to report the invoice.",
      });

    return await this.api
      .production(
        this.egs_info.production_certificate,
        this.egs_info.production_api_secret
      )
      .clearanceInvoice(
        signed_invoice_string,
        invoice_hash,
        this.egs_info.uuid
      );
  }

  /* Signs a given invoice using the EGS certificate and keypairs. */
  signInvoice(
    invoice: ZATCATaxInvoice,
    production?: boolean
  ): { signed_invoice_string: string; invoice_hash: string; qr: string } {
    const certificate = production
      ? this.egs_info.production_certificate
      : this.egs_info.compliance_certificate;
    if (!certificate || !this.egs_info.private_key)
      throwErrorObject({
        message:
          "EGS is missing a certificate/private key to sign the invoice.",
      });

    return invoice.sign(certificate, this.egs_info.private_key);
  }
}
