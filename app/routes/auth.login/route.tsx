import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import {
  clearBillingReturnContextCookie,
  getBillingReturnContext,
} from "../../utils/billing-return-context.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const queryShop = url.searchParams.get("shop");
  const billingReturnContext = queryShop
    ? null
    : getBillingReturnContext(request);

  if (billingReturnContext?.shop) {
    url.searchParams.set("shop", billingReturnContext.shop);
    url.searchParams.set("returnTo", billingReturnContext.returnTo);

    if (billingReturnContext.host && !url.searchParams.has("host")) {
      url.searchParams.set("host", billingReturnContext.host);
    }

    throw redirect(url.pathname + url.search, {
      headers: {
        "Set-Cookie": clearBillingReturnContextCookie(),
      },
    });
  }

  const errors = loginErrorMessage(await login(request));

  return { errors, shop: queryShop || "" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState(loaderData.shop);
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
          <s-section heading="Log in">
            <s-text-field
              name="shop"
              label="Shop domain"
              details="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={errors.shop}
            ></s-text-field>
            <s-button type="submit">Log in</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
