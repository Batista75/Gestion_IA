import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LaterSection({
  title,
  summary,
  items,
}: {
  title: string;
  summary: string;
  items: string[];
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pas encore dans ce socle</CardTitle>
          <CardDescription>
            Ces capacités sont dans la spécification. Elles ne sont pas
            simulées ici.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-2 pl-5 text-sm leading-6">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
