import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Le copilote comprend la demande, s’appuie sur les fiches déjà
          enregistrées, puis propose ou répond. Il ne calcule pas les prix et
          n’émet pas de facture. L’index et la conversation passent l’un après
          l’autre sur la carte graphique du PC hôte.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
