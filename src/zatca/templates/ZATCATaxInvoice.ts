import { XMLDocument } from "../../parser/index.js";
import { generateSignedXMLString } from "../signing/index.js";
import defaultSimplifiedTaxInvoice, {
  ZATCAInvoiceLineItem as ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
  DocumentCurrencyCode,
  ZATCAInvoiceLineItemDiscount,
} from "./tax_invoice_template.js";

declare global {
  interface Number {
    toFixedNoRounding: (n: number) => string;
  }
}

Number.prototype.toFixedNoRounding = function (n: number) {
  const reg = new RegExp("^-?\\d+(?:\\.\\d{0," + n + "})?", "g");
  let m = this.toString().match(reg);
  if (m?.length) {
    const a = m[0];
    const dot = a.indexOf(".");
    if (dot === -1) {
      return a + "." + "0".repeat(n);
    }
    const b = n - (a.length - dot) + 1;
    return b > 0 ? a + "0".repeat(b) : a;
  }
  return "0.00";
};

export {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
};
export class ZATCATaxInvoice {
  private invoice_xml: XMLDocument;

  /**
   * Parses a ZATCA  Tax Invoice XML string. Or creates a new one based on given props.*/
  constructor({
    invoice_xml_str,
    props,
  }: {
    invoice_xml_str?: string;
    props?: ZATCAInvoiceProps;
  }) {
    if (invoice_xml_str) {
      this.invoice_xml = new XMLDocument(invoice_xml_str);
      if (!this.invoice_xml)
        throw new Error("Error parsing invoice XML string.");
    } else {
      if (!props) throw new Error("Unable to create new XML invoice.");
      this.invoice_xml = new XMLDocument(defaultSimplifiedTaxInvoice(props));

      // Parsing
      this.parseLineItems(props.line_items ?? [], props);
    }
  }

  private constructLineItemTotals = (
    line_item: ZATCAInvoiceLineItem,
    CurrencyCode: DocumentCurrencyCode
  ) => {
    let line_item_total_discounts = 0;
    let line_item_total_taxes = 0;
    let cacAllowanceCharges: any[] = [];
    let cacClassifiedTaxCategories: any[] = [];
    let cacTaxTotal = {};

    const VAT = {
      "cbc:ID": line_item.VAT_percent ? "S" : "O",
      "cbc:Percent": line_item.VAT_percent
        ? (line_item.VAT_percent * 100).toFixedNoRounding(2)
        : undefined,
      "cac:TaxScheme": {
        "cbc:ID": "VAT",
      },
    };
    cacClassifiedTaxCategories.push(VAT);

    // Calc total discounts
    line_item.discounts?.map((discount) => {
      line_item_total_discounts += discount.amount;
      cacAllowanceCharges.push({
        "cbc:ChargeIndicator": "false",
        "cbc:AllowanceChargeReason": discount.reason,
        "cbc:Amount": {
          "@_currencyID": CurrencyCode,
          // BR-DEC-01
          "#text": (discount.amount / line_item.quantity).toFixedNoRounding(2),
        },
        "cbc:BaseAmount": {
          "@_currencyID": CurrencyCode,
          // BR-DEC-01
          "#text": line_item.tax_exclusive_price,
        },
      });
    });

    // Calc item subtotal
    // let line_item_subtotal = line_item.tax_exclusive_price * line_item.quantity;
    // line_item_subtotal = parseFloat(line_item_subtotal.toFixedNoRounding(2));

    let line_item_subtotal =
      line_item.tax_exclusive_price * line_item.quantity -
      line_item_total_discounts;
    line_item_subtotal = parseFloat(line_item_subtotal.toFixedNoRounding(2));

    // Calc total taxes
    // BR-KSA-DEC-02

    line_item_total_taxes =
      parseFloat(line_item_total_taxes.toFixedNoRounding(2)) +
      parseFloat(
        (line_item_subtotal * line_item.VAT_percent).toFixedNoRounding(2)
      );

    line_item_total_taxes = parseFloat(
      line_item_total_taxes.toFixedNoRounding(2)
    );

    // BR-KSA-DEC-03, BR-KSA-51
    cacTaxTotal = {
      "cbc:TaxAmount": {
        "@_currencyID": CurrencyCode,
        "#text": line_item_total_taxes.toFixedNoRounding(2),
      },
      "cbc:RoundingAmount": {
        "@_currencyID": CurrencyCode,
        "#text": (
          parseFloat(line_item_subtotal.toFixedNoRounding(2)) +
          parseFloat(line_item_total_taxes.toFixedNoRounding(2))
        ).toFixed(2),
      },
    };

    return {
      cacAllowanceCharges,
      cacClassifiedTaxCategories,
      cacTaxTotal,
      line_item_total_tax_exclusive: line_item_subtotal,
      line_item_total_taxes,
      line_item_total_discounts,
    };
  };

  private constructLineItem = (
    line_item: ZATCAInvoiceLineItem,
    CurrencyCode: DocumentCurrencyCode
  ) => {
    const {
      cacAllowanceCharges,
      cacClassifiedTaxCategories,
      cacTaxTotal,
      line_item_total_tax_exclusive,
      line_item_total_taxes,
      line_item_total_discounts,
    } = this.constructLineItemTotals(line_item, CurrencyCode);

    return {
      line_item_xml: {
        "cbc:ID": line_item.id,

        "cbc:Note": line_item.notes,
        "cbc:InvoicedQuantity": {
          "@_unitCode": "PCE",
          "#text": line_item.quantity,
        },
        // BR-DEC-23
        "cbc:LineExtensionAmount": {
          "@_currencyID": CurrencyCode,
          "#text": line_item_total_tax_exclusive.toFixedNoRounding(2),
        },
        "cac:TaxTotal": cacTaxTotal,
        "cac:Item": {
          "cbc:Name": line_item.name,
          "cac:ClassifiedTaxCategory": cacClassifiedTaxCategories,
        },
        "cac:Price": {
          "cbc:PriceAmount": {
            "@_currencyID": CurrencyCode,
            "#text":
              line_item.tax_exclusive_price -
              line_item_total_discounts / line_item.quantity,
          },
          "cac:AllowanceCharge": cacAllowanceCharges,
        },
      },
      line_item_totals: {
        taxes_total: line_item_total_taxes,
        discounts_total: line_item_total_discounts,
        subtotal: line_item_total_tax_exclusive,
      },
    };
  };

  private constructLegalMonetaryTotal = (
    tax_exclusive_subtotal: number,
    taxes_total: number,
    invoice_level_discount: number,
    PrepaidAmount: number,
    CurrencyCode: DocumentCurrencyCode
  ) => {
    return {
      // BR-DEC-09    total invoice LineItem befor VAT or discount
      "cbc:LineExtensionAmount": {
        "@_currencyID": CurrencyCode,
        "#text": (
          tax_exclusive_subtotal + invoice_level_discount
        ).toFixedNoRounding(2),
      },
      //BR-DEC-12 total invoice LineItem with  discount befor VAT
      "cbc:TaxExclusiveAmount": {
        "@_currencyID": CurrencyCode,
        "#text": tax_exclusive_subtotal.toFixedNoRounding(2),
      },
      // BR-DEC-14, BT-112 final price the customer needs to pay(base price and the applicable VAT),
      "cbc:TaxInclusiveAmount": {
        "@_currencyID": CurrencyCode,
        "#text": parseFloat((tax_exclusive_subtotal + taxes_total).toFixed(2)),
      },
      "cbc:AllowanceTotalAmount": {
        "@_currencyID": CurrencyCode,
        "#text": invoice_level_discount,
      },
      "cbc:PrepaidAmount": {
        "@_currencyID": CurrencyCode,
        "#text":
          PrepaidAmount != null ? PrepaidAmount.toFixedNoRounding(2) : 0.0,
      },
      // BR-DEC-18, BT-112
      "cbc:PayableAmount": {
        "@_currencyID": CurrencyCode,
        "#text": parseFloat((tax_exclusive_subtotal + taxes_total).toFixed(2)),
      },
    };
  };

  private constructTaxTotal = (
    line_items: ZATCAInvoiceLineItem[],
    CurrencyCode: DocumentCurrencyCode,
    conversion_rate: number,
    invoice_level_discount: number
  ) => {
    const cacTaxSubtotal: any[] = [];
    const addTaxSubtotal = (
      taxable_amount: number,
      tax_amount: number,
      tax_percent: number
    ) => {
      cacTaxSubtotal.push({
        // BR-DEC-19
        "cbc:TaxableAmount": {
          "@_currencyID": CurrencyCode,
          "#text": taxable_amount.toFixedNoRounding(2),
        },
        "cbc:TaxAmount": {
          "@_currencyID": CurrencyCode,
          "#text": tax_amount.toFixedNoRounding(2),
        },
        "cac:TaxCategory": {
          "cbc:ID": {
            "@_schemeAgencyID": 6,
            "@_schemeID": "UN/ECE 5305",
            "#text": tax_percent ? "S" : "O",
          },
          "cbc:Percent": (tax_percent * 100).toFixedNoRounding(2),
          // BR-O-10
          "cbc:TaxExemptionReason": tax_percent
            ? undefined
            : "Not subject to VAT",
          "cac:TaxScheme": {
            "cbc:ID": {
              "@_schemeAgencyID": "6",
              "@_schemeID": "UN/ECE 5153",
              "#text": "VAT",
            },
          },
        },
      });
    };

    let taxes_total = 0;
    let taxable_amount = 0;
    line_items.map((line_item) => {
      const total_line_item_discount = line_item.discounts?.reduce(
        (p, c) => p + c.amount,
        0
      );
      const item_taxable_amount =
        line_item.tax_exclusive_price * line_item.quantity -
        (total_line_item_discount ?? 0) -
        invoice_level_discount / line_items.length;
      taxable_amount += item_taxable_amount;

      let tax_amount = line_item.VAT_percent * item_taxable_amount;

      taxes_total += parseFloat(tax_amount.toFixedNoRounding(2));
    });

    addTaxSubtotal(taxable_amount, taxes_total, line_items[0].VAT_percent);
    taxes_total = parseFloat(taxes_total.toFixed(2));

    return [
      {
        "cbc:TaxAmount": {
          "@_currencyID": CurrencyCode,
          "#text": taxes_total.toFixedNoRounding(2),
        },
        "cac:TaxSubtotal": cacTaxSubtotal,
      },
      {
        // TaxAmount must be SAR even if the invoice is USD
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text":
            CurrencyCode != DocumentCurrencyCode.SAR
              ? (taxes_total * conversion_rate).toFixedNoRounding(2) ??
                (1).toFixedNoRounding(2)
              : taxes_total.toFixedNoRounding(2),
        },
      },
    ];
  };

  private constructAllowanceCharge = (
    discount: ZATCAInvoiceLineItemDiscount,
    CurrencyCode: DocumentCurrencyCode,
    VAT_percent: number
  ) => {
    const cacTaxCategory: any = {
      "cbc:ChargeIndicator": {
        "#text": "false",
      },
      "cbc:AllowanceChargeReason": {
        "#text": discount.reason,
      },
      "cbc:Amount": {
        "@_currencyID": CurrencyCode,
        "#text": discount.amount,
      },
      "cac:TaxCategory": {
        "cbc:ID": {
          "@_schemeAgencyID": 6,
          "@_schemeID": "UN/ECE 5305",
          "#text": true ? "S" : "O",
        },
        "cbc:Percent": (VAT_percent * 100).toFixedNoRounding(2),
        "cac:TaxScheme": {
          "cbc:ID": {
            "@_schemeAgencyID": "6",
            "@_schemeID": "UN/ECE 5153",
            "#text": "VAT",
          },
        },
        // BR-O-10
      },
    };

    return cacTaxCategory;
  };

  private parseLineItems(
    line_items: ZATCAInvoiceLineItem[],
    props: ZATCAInvoiceProps
  ) {
    let total_taxes: number = 0;
    let total_subtotal: number = 0;
    let line_item_total_discounts: number = 0;
    let invoice_line_items: any[] = [];

    line_items.map((line_item) => {
      const { line_item_xml, line_item_totals } = this.constructLineItem(
        line_item,
        props.documentCurrencyCode
      );

      line_item.discounts?.map((total_discount) => {
        line_item_total_discounts += total_discount.amount;
      });

      total_taxes += parseFloat(
        line_item_totals.taxes_total.toFixedNoRounding(2)
      );
      total_subtotal += parseFloat(
        line_item_totals.subtotal.toFixedNoRounding(2)
      );

      invoice_line_items.push(line_item_xml);
    });

    // BT-110
    props.invoice_level_discount
      ? (total_taxes = parseFloat(
          (
            total_taxes -
            props.invoice_level_discount.amount * line_items[0].VAT_percent
          ).toFixed(2)
        ))
      : parseFloat(total_taxes.toFixed(2));

    total_subtotal = props.invoice_level_discount
      ? parseFloat(
          (total_subtotal - props.invoice_level_discount.amount).toFixed(2)
        )
      : parseFloat(total_subtotal.toFixed(2));

    this.invoice_xml.set("Invoice/cac:Delivery", false, {
      "cbc:ActualDeliveryDate": props.delivery_date,
    });

    if (props.cancelation) {
      // Invoice canceled. Tunred into credit/debit note. Must have PaymentMeans
      this.invoice_xml.set("Invoice/cac:PaymentMeans", false, {
        "cbc:PaymentMeansCode": props.payment_method,
        "cbc:InstructionNote": props.cancelation.reason ?? "No note Specified",
      });
    } else {
      this.invoice_xml.set("Invoice/cac:PaymentMeans", false, {
        "cbc:PaymentMeansCode": props.payment_method,
      });
    }

    props.invoice_level_discount &&
      this.invoice_xml.set(
        "Invoice/cac:AllowanceCharge",
        false,
        this.constructAllowanceCharge(
          props.invoice_level_discount,
          props.documentCurrencyCode,
          line_items[0].VAT_percent
        )
      );

    this.invoice_xml.set(
      "Invoice/cac:TaxTotal",
      false,
      this.constructTaxTotal(
        line_items,
        props.documentCurrencyCode,
        props.conversion_rate,
        props.invoice_level_discount ? props.invoice_level_discount.amount : 0
      )
    );

    this.invoice_xml.set(
      "Invoice/cac:LegalMonetaryTotal",
      true,
      this.constructLegalMonetaryTotal(
        total_subtotal,
        total_taxes,
        props.invoice_level_discount ? props.invoice_level_discount.amount : 0,
        props.PrepaidAmount,
        props.documentCurrencyCode
      )
    );

    invoice_line_items.map((line_item) => {
      this.invoice_xml.set("Invoice/cac:InvoiceLine", false, line_item);
    });
  }

  getXML(): XMLDocument {
    return this.invoice_xml;
  }

  /**
   * Signs the invoice.*/

  sign(certificate_string: string, private_key_string: string) {
    return generateSignedXMLString({
      invoice_xml: this.invoice_xml,
      certificate_string: certificate_string,
      private_key_string: private_key_string,
    });
  }
}
