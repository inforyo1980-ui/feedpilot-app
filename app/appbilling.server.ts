import { BillingInterval } from "@shopify/shopify-api";

export const billingConfig = {
  "Pro Plan": {
    amount: 9.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
  },
};