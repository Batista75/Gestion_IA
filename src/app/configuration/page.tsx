import { GPU_SIZING_NOTE, modelsForRole } from "@/domain/agent";
import { maskSecret } from "@/domain/technical-settings";
import { CompanyForm } from "@/components/company-form";
import { ConfigurationForm } from "@/components/configuration-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadCompany } from "@/lib/company-store";
import { getOllamaStatus } from "@/lib/ollama";
import { loadTechnicalConfig } from "@/lib/technical-settings";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const [config, status, company] = await Promise.all([loadTechnicalConfig(), getOllamaStatus(), loadCompany()]);
  const chatModels = modelsForRole(status.models, "chat");
  const embedModels = modelsForRole(status.models, "embed");
  const rerankModels = modelsForRole(status.models, "rerank");
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Configuration</h1>
        <p className="max-w-3xl text-sm leading-5 text-muted-foreground">
          L’identité de l’entreprise et son logo figurent sur les documents. Le serveur d’inférence, le type de modèle et la clé d’API se règlent ensuite.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto xl:grid-cols-2 xl:overflow-hidden">
      <Card className="min-h-0 xl:overflow-auto">
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
          <CardDescription>
            Raison sociale, coordonnées et logo. Ils s’impriment en tête du devis, de la commande et de la facture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm company={company} />
        </CardContent>
      </Card>

      <div className="grid min-h-0 content-start gap-3 overflow-auto">
      <Card>
        <CardHeader>
          <CardTitle>État du serveur</CardTitle>
          <CardDescription>
            {config.fromScreen
              ? "Ces valeurs viennent de cet écran."
              : "Ces valeurs viennent encore du fichier d’environnement, tant que vous n’enregistrez pas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.ok ? "secondary" : "destructive"}>
              {status.ok ? "Serveur joignable" : "Serveur injoignable"}
            </Badge>
            {status.baseUrl ? <span className="break-all text-muted-foreground">{status.baseUrl}</span> : null}
          </div>
          {status.error ? <p className="text-destructive">{status.error}</p> : null}
          {status.warning ? <p>{status.warning}</p> : null}
          <p>
            Modèle conversationnel : {status.defaultModel || "aucun sur ce serveur"}. Embeddings :{" "}
            {status.embedModel || "aucun sur ce serveur"}. Reranker :{" "}
            {status.rerankModel || "aucun sur ce serveur"}.
          </p>
          <p>Clé d’API : {config.hasSavedKey ? maskSecret(config.apiKey) : "aucune"}.</p>
          <p className="text-muted-foreground">{GPU_SIZING_NOTE}</p>
          <p className="text-muted-foreground">
            Les fiches sont dans PostgreSQL sur cette machine. Le mot de passe de la base n’est pas affiché ici.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serveur et modèles</CardTitle>
          <CardDescription>
            Une adresse publique est refusée. La clé reste dans la base locale et part seulement vers le serveur indiqué.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigurationForm
            serverUrl={config.serverUrl || status.baseUrl}
            chatModel={config.chatModel || status.defaultModel || ""}
            embedModel={config.embedModel || status.embedModel || ""}
            rerankModel={config.rerankModel || status.rerankModel || ""}
            keyHint={maskSecret(config.apiKey)}
            chatModels={chatModels}
            embedModels={embedModels}
            rerankModels={rerankModels}
          />
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
