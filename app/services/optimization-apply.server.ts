import { recordOptimizationHistory } from "./optimization-history.server";

type ApplyOptimizedTitleInput = {
  admin: any;
  shopDomain: string;
  productId: string;

  titleBefore: string;
  titleAfter: string;

  descriptionBefore?: string | null;
  descriptionAfter?: string | null;

  seoScoreBefore?: number | null;
  seoScoreAfter?: number | null;
  issueCountBefore?: number | null;
  issueCountAfter?: number | null;

  whyText?: string | null;
  outcomeText?: string | null;
  actionText?: string | null;

  rawIssuesJson?: string | null;
  rawDecisionJson?: string | null;

  source?: "manual" | "automation" | "weekly";
  decisionMode?: "suggest" | "auto";
};

export async function applyOptimizedTitleAndRecord(
  input: ApplyOptimizedTitleInput
) {
  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          descriptionHtml
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const updateInput: Record<string, any> = {
    id: input.productId,
    title: input.titleAfter,
  };

  if (typeof input.descriptionAfter === "string") {
    updateInput.descriptionHtml = input.descriptionAfter;
  }

  const response = await input.admin.graphql(mutation, {
    variables: {
      input: updateInput,
    },
  });

  const json = await response.json();
  const result = json?.data?.productUpdate;
  const userErrors = result?.userErrors ?? [];

  if (userErrors.length > 0) {
    await recordOptimizationHistory({
      shopDomain: input.shopDomain,
      productId: input.productId,
      productTitleBefore: input.titleBefore,
      productTitleAfter: input.titleAfter,
      seoScoreBefore: input.seoScoreBefore ?? null,
      seoScoreAfter: input.seoScoreAfter ?? null,
      issueCountBefore: input.issueCountBefore ?? null,
      issueCountAfter: input.issueCountAfter ?? null,
      whyText: input.whyText ?? null,
      outcomeText: input.outcomeText ?? null,
      actionText: input.actionText ?? null,
      rawIssuesJson: input.rawIssuesJson ?? null,
      rawDecisionJson: input.rawDecisionJson ?? null,
      source: input.source ?? "manual",
      decisionMode: input.decisionMode ?? "suggest",
      status: "failed",
      changeType: "title",
    });

    return {
      ok: false,
      userErrors,
    };
  }

  const created = await recordOptimizationHistory({
    shopDomain: input.shopDomain,
    productId: input.productId,
    productTitleBefore: input.titleBefore,
    productTitleAfter: input.titleAfter,
    seoScoreBefore: input.seoScoreBefore ?? null,
    seoScoreAfter: input.seoScoreAfter ?? null,
    issueCountBefore: input.issueCountBefore ?? null,
    issueCountAfter: input.issueCountAfter ?? null,
    whyText: input.whyText ?? null,
    outcomeText: input.outcomeText ?? null,
    actionText: input.actionText ?? null,
    rawIssuesJson: input.rawIssuesJson ?? null,
    rawDecisionJson: input.rawDecisionJson ?? null,
    source: input.source ?? "manual",
    decisionMode: input.decisionMode ?? "suggest",
    status: "applied",
    changeType: "title",
  });

  return {
    ok: true,
    history: created,
    product: result?.product ?? null,
  };
}