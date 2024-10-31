import axios from "axios";
import { cleanUpCertificateString } from "../signing/index.js"; 
import { throwErrorObject } from "../../../lib/errorType.js"; 
import { log } from "../../logger/index.js";
import { handleInvoiceError } from "./handelError.js";
const settings = {
  API_VERSION: "V2",
  // SANDBOX_BASEURL: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  SANDBOX_BASEURL: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
  PRODUCTION_BASEURL: "TODO",
};

interface ComplianceAPIInterface {
  /**
   * Requests a new compliance certificate and secret.
   * @param csr String CSR
   * @param otp String Tax payer provided OTP from Fatoora portal
   * @returns issued_certificate: string, api_secret: string, or throws on error.
   */
  issueCertificate: (
    csr: string,
    otp: string
  ) => Promise<{
    issued_certificate: string;
    api_secret: string;
    request_id: string;
  }>;

  /**
   * Checks compliance of a signed ZATCA XML.
   * @param signed_xml_string String.
   * @param invoice_hash String.
   * @param egs_uuid String.
   * @returns Any status.
   */
  checkInvoiceCompliance: (
    signed_xml_string: string,
    invoice_hash: string,
    egs_uuid: string
  ) => Promise<any>;
}

interface ProductionAPIInterface {
  /**
   * Requests a new production certificate and secret.
   * @param compliance_request_id String compliance_request_id
   * @returns issued_certificate: string, api_secret: string, or throws on error.
   */
  issueCertificate: (compliance_request_id: string) => Promise<{
    issued_certificate: string;
    api_secret: string;
    request_id: string;
  }>;

  /**
   * Report signed ZATCA XML.
   * @param signed_xml_string String.
   * @param invoice_hash String.
   * @param egs_uuid String.
   * @returns Any status.
   */
  clearanceInvoice: (
    signed_xml_string: string,
    invoice_hash: string,
    egs_uuid: string
  ) => Promise<any>;
}

class API {
  constructor() {}

  private getAuthHeaders = (certificate?: string, secret?: string): any => {
    if (certificate && secret) {
      const certificate_stripped = cleanUpCertificateString(certificate);
      const basic = Buffer.from(
        `${Buffer.from(certificate_stripped).toString("base64")}:${secret}`
      ).toString("base64");
      return {
        Authorization: `Basic ${basic}`,
      };
    }
    return {};
  };

  compliance(certificate?: string, secret?: string): ComplianceAPIInterface {
    const auth_headers = this.getAuthHeaders(certificate, secret);

    const issueCertificate = async (
      csr: string,
      otp: string
    ): Promise<{
      issued_certificate: string;
      api_secret: string;
      request_id: string;
    }> => {
      const headers = {
        "Accept-Version": settings.API_VERSION,
        OTP: otp,
      };
      try {
        const response = await axios.post(
          `${settings.SANDBOX_BASEURL}/compliance`,
          { csr: Buffer.from(csr).toString("base64") },
          { headers: { ...auth_headers, ...headers } }
        );

        if (response.status !== 200)
          throw new Error("Error issuing a compliance certificate.");

        let issued_certificate = Buffer.from(
          response.data.binarySecurityToken,
          "base64"
        ).toString();
        issued_certificate = `-----BEGIN CERTIFICATE-----\n${issued_certificate}\n-----END CERTIFICATE-----`;
        const api_secret = response.data.secret;
        return {
          issued_certificate,
          api_secret,
          request_id: response.data.requestID,
        };
      } catch (error) {
        throwErrorObject({
          Statcode: error.response.status,
          message: error.response.data,
        });
      }
    };

    const checkInvoiceCompliance = async (
      signed_xml_string: string,
      invoice_hash: string,
      egs_uuid: string
    ): Promise<any> => {
      const headers = {
        "Accept-Version": settings.API_VERSION,
        "Accept-Language": "en",
      };

      try {
        const response = await axios.post(
          `${settings.SANDBOX_BASEURL}/compliance/invoices`,
          {
            invoiceHash: invoice_hash,
            uuid: egs_uuid,
            invoice: Buffer.from(signed_xml_string).toString("base64"),
          },
          { headers: { ...auth_headers, ...headers } }
        );
        console.log(response.data);
        if (response.status != 200)
          throwErrorObject({
            message: "Error in compliance check.",
          });

        return response.data;
      } catch (error) {
        console.log(error.response.data);
        throwErrorObject({
          Statcode: error.response.status,
          ...error.response.data,
        });
      }
    };

    return {
      issueCertificate,
      checkInvoiceCompliance,
    };
  }

  production(certificate?: string, secret?: string): ProductionAPIInterface {
    const auth_headers = this.getAuthHeaders(certificate, secret);

    const issueCertificate = async (
      compliance_request_id: string
    ): Promise<{
      issued_certificate: string;
      api_secret: string;
      request_id: string;
    }> => {
      const headers = {
        accept: "application/json",
        "Accept-Version": settings.API_VERSION,
        "Accept-Language": "en",
        "Content-Type": "application/json",
      };

      try {
        const response = await axios.post(
          `${settings.SANDBOX_BASEURL}/production/csids`,
          { compliance_request_id: compliance_request_id },
          { headers: { ...auth_headers, ...headers } }
        );
        if (response.status === 200) return response.data;

        throw new Error(`Error issuing a production certificate.`);
      } catch (error) {
        throwErrorObject({
          Statcode: error.response.status,
          message: error.response.data,
        });
      }
    };

    //work only in invoice route
    const clearanceInvoice = async (
      signed_xml_string: string,
      invoice_hash: string,
      egs_uuid: string
    ): Promise<any> => {
      const headers = {
        "Accept-Version": settings.API_VERSION,
        "Accept-Language": "en",
        "Clearance-Status": "1",
      };

      try {
        const response = await axios.post(
          `${settings.SANDBOX_BASEURL}/invoices/clearance/single`,
          {
            invoiceHash: invoice_hash,
            uuid: egs_uuid,
            invoice: Buffer.from(signed_xml_string).toString("base64"),
          },
          { headers: { ...auth_headers, ...headers } }
        );
        if (response.status === 200) {
          log(
            "Info",
            "clearedInvoice",
            `Invoice cleared successfully:  ${invoice_hash}`
          );
          return response.data;
        }

        throwErrorObject(response, false);
      } catch (error) {
        handleInvoiceError(error, signed_xml_string, invoice_hash);
      }
    };

    return {
      issueCertificate,
      clearanceInvoice,
    };
  }
}

export default API;
