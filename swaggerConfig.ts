import swaggerJsdoc, { Options } from "swagger-jsdoc";
import { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";

const Location = {
  type: "object",
  properties: {
    city: {
      type: "string",
      example: "safwa",
    },
    city_subdivision: {
      type: "string",
      example: "Al-hazm Dist",
    },
    street: {
      type: "string",
      example: "street street st",
    },
    plot_identification: {
      type: "string",
      example: "4167",
    },
    building: {
      type: "string",
      example: "6602",
    },
    postal_zone: {
      type: "string",
      example: "32714",
    },
  },
};
const EGSUnit = {
  type: "object",
  properties: {
    VAT_name: {
      type: "string",
      example: "NASSIR SAL HYDER AND PARTNER CO",
    },
    branch_name: {
      type: "string",
      example: "NASSIR SAL HYDER AND PARTNER CO",
    },
    branch_industry: {
      type: "string",
      example: "General Contracting",
    },
    VAT_number: {
      type: "string",
      example: "300410462100003",
    },
    custom_id: {
      type: "string",
      example: "EGS1-652790376",
    },
    CRN_number: {
      type: "string",
      example: "20630605934",
    },
    model: {
      type: "string",
      example: "IOS",
    },
    location: Location,
  },
};
const EGS_UNIT = {
  type: "object",
  properties: {
    egs_unit: EGSUnit,
    otp: {
      type: "string",
      example: "167157",
    },
    device_name: {
      type: "string",
      example: "Device Name4",
    },
  },
};

const Cancelation = {
  type: "object",
  properties: {
    canceled_invoice_number: {
      type: "number",
    },
    reason: {
      type: "string",
    },
    cancelation_type: {
      type: "string",
      enum: ["10", "Type2", "Type3"],
    },
  },
};
const EGSUnitInfoSchema = {
  type: "object",
  properties: {
    custom_id: {
      type: "string",
    },
    CRN_number: {
      type: "string",
    },
    VAT_name: {
      type: "string",
    },
    VAT_number: {
      type: "string",
    },
    location: {
      type: "object",
      properties: {
        city: { type: "string", example: "safwa" },
        city_subdivision: { type: "string", example: "Al-hazm Dist" },
        street: { type: "string", example: "street street st" },
        plot_identification: { type: "string", example: "4167" },
        building: { type: "string", example: "6602" },
        postal_zone: { type: "string", example: "32714" },
      },
    },
  },
};
const ZatcaCustomerInfoSchema = {
  type: "object",
  properties: {
    // Define properties for ZatcaCustomerInfoSchema here
  },
};
const ZATCAInvoiceLineItemSchema = {
  type: "object",
  properties: {
    id: { type: "number", example: 1 },
    name: { type: "string", example: "producat name" },
    note: { type: "string" },
    quantity: { type: "number", example: 1 },
    tax_exclusive_price: { type: "number", example: 7500 },
    VAT_percent: { type: "number", example: 0.15 },
    discounts: [
      {
        reason: { type: "string", example: "reason" },
        amount: { type: "number", example: 250 },
      },
    ],
  },
};
const productionData = {
  type: "object",
  properties: {
    private_key: {
      type: "string",
    },
    production_certificate: {
      type: "string",
    },
    production_api_secret: {
      type: "string",
    },
  },
};
const ZATCAInvoiceProps = {
  type: "object",
  properties: {
    egs_info: EGSUnitInfoSchema,
    customerInfo: ZatcaCustomerInfoSchema,
    invoice_counter_number: {
      type: "number",
    },
    invoice_serial_number: {
      type: "string",
    },
    conversion_rate: {
      type: "number",
    },
    delivery_date: {
      type: "string",
      example: "2024-07-13",
    },
    documentCurrencyCode: {
      type: "string",
      enum: ["USD", "EUR", "GBP"],
    },
    payment_method: {
      type: "string",
      enum: ["CreditCard", "Cash", "PayPal"],
    },
    previous_invoice_hash: {
      type: "string",
    },
    cancelation: Cancelation,
    line_items: {
      type: "array",
      items: ZATCAInvoiceLineItemSchema,
    },
  },
  required: [
    "invoice_counter_number",
    "conversion_rate",
    "invoice_serial_number",
    "issue_date",
    "delivery_date",
    "issue_time",
    "egs_info",
    "customerInfo",
    "documentCurrencyCode",
    "payment_method",
    "previous_invoice_hash",
    "line_items",
  ],
};
const ZATCATaxInvoiceSchemaType = {
  type: "object",
  properties: {
    props: ZATCAInvoiceProps,
    productionData: productionData,
  },
  required: ["props", "productionData"],
};

const res = {
  type: "object",
  properties: {
    validationResults: {
      type: "object",
      properties: {
        infoMessages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              code: { type: "string" },
              category: { type: "string" },
              message: { type: "string" },
              status: { type: "string" },
            },
          },
        },
        warningMessages: {
          type: "array",
          items: { type: "object" },
        },
        errorMessages: {
          type: "array",
          items: { type: "object" },
        },
        status: { type: "string" },
      },
    },
    clearanceStatus: { type: "string" },
    clearedInvoice: { type: "string" },
    invoice_hash: { type: "string" },
  },
  example: {
    validationResults: {
      infoMessages: [
        {
          type: "INFO",
          code: "XSD_ZATCA_VALID",
          category: "XSD validation",
          message:
            "Complied with UBL 2.1 standards in line with ZATCA specifications",
          status: "PASS",
        },
      ],
      warningMessages: [],
      errorMessages: [],
      status: "PASS",
    },
    clearanceStatus: "CLEARED",
    clearedInvoice: "clearedInvoice",
    invoice_hash: "x8DGd3wWhL1o3SCtmpKsoXSq/CneOp/kcWx9oHTNOUQ=",
  },
};

const swaggerOptions: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ZATCA Tax Invoice API",
      version: "1.0.0",
    },

    paths: {
      "/new_egs": {
        post: {
          summary: "Create a new EGS unit",
          consumes: ["application/json"],
          produces: ["application/json"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: EGS_UNIT,
              },
            },
          },
          responses: {
            200: {
              description: "Successful operation",
              content: {
                "application/json": {
                  schema: EGS_UNIT,
                },
              },
            },
            400: {
              description: "Invalid request payload",
            },
            500: {
              description: "Internal server error",
            },
          },
        },
      },
      "/ivoice": {
        post: {
          summary: "ZATCA Tax Invoice API",
          consumes: ["application/json"],
          produces: ["application/json"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ZATCATaxInvoiceSchemaType,
              },
            },
          },
          responses: {
            200: {
              description: "Successful operation",
              content: {
                "application/json": {
                  schema: res,
                },
              },
            },
            400: {
              description: "Invalid request payload",
            },
            500: {
              description: "Internal server error",
            },
          },
        },
      },
    },
  },
  apis: ["/new_egs"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

function swaggerDoc(app: Express) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("docs.json", (req: Request, res: Response) => {
    res.setHeader("content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

export default swaggerDoc;
