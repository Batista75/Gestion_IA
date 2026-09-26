import type { CompanyDraft } from "@/domain/company";

export type SheetLine = {
  name: string;
  kind: string;
  quantity: number;
  unitLabel: string;
  amountLabel: string;
};

export function CommercialSheet({
  heading,
  title,
  dateLabel,
  dossier,
  company,
  partyRole,
  partyName,
  partyLines,
  lines,
  totalLabel,
  notes,
  deliveryLines = [],
}: {
  heading: string;
  title: string;
  dateLabel: string;
  dossier: string;
  company: CompanyDraft & { logoUrl: string | null };
  partyRole: string;
  partyName: string;
  partyLines: string[];
  lines: SheetLine[];
  totalLabel: string;
  notes: string[];
  deliveryLines?: string[];
}) {
  const identity = [
    company.address,
    [company.postalCode, company.city].filter(Boolean).join(" "),
    company.country,
    company.email,
    company.phone,
    company.siren ? `SIREN ${company.siren}` : "",
    company.vatNumber ? `TVA ${company.vatNumber}` : "",
  ].filter(Boolean);
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6 rounded-lg border bg-white p-4 text-neutral-950 sm:p-8 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="" className="h-16 w-auto max-w-48 object-contain" />
          ) : null}
          <p className="text-lg font-semibold">{company.legalName || "Raison sociale non renseignée"}</p>
          {identity.map((line) => (
            <p key={line} className="text-sm leading-5">
              {line}
            </p>
          ))}
        </div>
        <div className="grid gap-1 text-sm">
          <h1 className="text-xl font-semibold">{heading}</h1>
          <p>{title}</p>
          <p>Date {dateLabel}</p>
          <p>Dossier {dossier}</p>
        </div>
      </header>
      <section className="grid gap-1 text-sm">
        <p className="font-medium">{partyRole}</p>
        <p>{partyName}</p>
        {partyLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
      <section className="grid gap-1 text-sm">
        <p className="font-medium">Livraison</p>
        {deliveryLines.length === 0 ? (
          <p>Non précisée sur le dossier.</p>
        ) : (
          deliveryLines.map((line) => <p key={line}>{line}</p>)
        )}
      </section>
      {lines.length === 0 ? (
        <p className="text-sm">Aucune ligne sur ce document.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-3 font-medium">Désignation</th>
                <th className="py-2 pr-3 font-medium">Qté</th>
                <th className="py-2 pr-3 font-medium">Prix unitaire HT</th>
                <th className="py-2 font-medium">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.kind}-${line.name}-${index}`} className="border-b border-neutral-200">
                  <td className="py-2 pr-3">
                    {line.kind === "service" ? "Service" : "Produit"} {line.name}
                  </td>
                  <td className="py-2 pr-3">{line.quantity}</td>
                  <td className="py-2 pr-3">{line.unitLabel}</td>
                  <td className="py-2">{line.amountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm font-medium">{totalLabel}</p>
      {notes.map((note) => (
        <p key={note} className="text-sm leading-6">
          {note}
        </p>
      ))}
    </article>
  );
}
