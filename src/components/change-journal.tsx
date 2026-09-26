import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JournalEntry } from "@/lib/record-journal";

export function ChangeJournal({
  entries,
  title = "Modifications",
}: {
  entries: JournalEntry[];
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Chaque création, correction et suppression est datée et horodatée sur cette machine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune modification pour le moment. Un contact ajouté ou une information complétée depuis l’assistant apparaît ici après confirmation.
          </p>
        ) : (
          <ul className="grid gap-2">
            {entries.map((entry) => (
              <li key={entry.id} className="text-sm leading-6 break-words">
                <span className="text-muted-foreground">{entry.at}</span>
                {" · "}
                <span className="font-medium">{entry.name}</span>
                {" · "}
                {entry.source}
                {" · "}
                {entry.summary}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
