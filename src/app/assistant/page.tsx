import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Le copilote prépare, explique, et peut créer ou mettre à jour un
          client, un fournisseur, un produit, un projet ou un devis. Il ne
          calcule pas les prix et n’émet pas de facture. L’inférence se fait
          sur le PC hôte, avec Ollama et la carte graphique.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
