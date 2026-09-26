"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid max-w-lg gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        La page n’a pas pu s’afficher
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        La base locale est peut-être arrêtée. Relancez le démarrage de
        PostgreSQL, puis réessayez. Les saisies déjà enregistrées restent dans
        la base.
      </p>
      <Button type="button" onClick={reset} className="min-h-11 w-fit px-4">
        Réessayer
      </Button>
    </div>
  );
}
