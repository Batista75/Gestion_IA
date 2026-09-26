"use client";

import { useMemo, useState } from "react";
import { quoteFromTargetMarkup } from "@/domain/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const percent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 2,
});

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  return Number(normalized);
}

export function PriceSimulator() {
  const [cost, setCost] = useState("700");
  const [markup, setMarkup] = useState("30");
  const [discount, setDiscount] = useState("10");

  const result = useMemo(() => {
    const directCostHt = parseAmount(cost);
    const targetMarkupRate = parseAmount(markup) / 100;
    const discountRate = parseAmount(discount) / 100;
    try {
      return {
        quote: quoteFromTargetMarkup({
          directCostHt,
          targetMarkupRate,
          discountRate,
        }),
        error: null,
      };
    } catch (error) {
      return {
        quote: null,
        error:
          error instanceof Error
            ? error.message
            : "Le calcul n’a pas pu être fait.",
      };
    }
  }, [cost, markup, discount]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="cost">Coût direct HT</Label>
          <Input
            id="cost"
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="markup">Taux de marque visé (%)</Label>
          <Input
            id="markup"
            inputMode="decimal"
            value={markup}
            onChange={(event) => setMarkup(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="discount">Remise client (%)</Label>
          <Input
            id="discount"
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </div>
      </div>
      {result.error ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : result.quote ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">Prix affiché HT</dt>
            <dd className="text-lg font-semibold">
              {euro.format(result.quote.listPriceHt)}
            </dd>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">Prix net HT</dt>
            <dd className="text-lg font-semibold">
              {euro.format(result.quote.netPriceHt)}
            </dd>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">Marge directe</dt>
            <dd className="text-lg font-semibold">
              {euro.format(result.quote.directMarginHt)}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                ({percent.format(result.quote.achievedMarkupRate)})
              </span>
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Formule déterministe : prix net = coût / (1 − taux de marque), prix
        affiché = coût / [(1 − taux de marque) × (1 − remise)]. Ce prix est une
        aide, pas un devis émis.
      </p>
    </div>
  );
}
