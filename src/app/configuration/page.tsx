import { GPU_SIZING_NOTE, isEmbedOnlyModel } from "@/domain/agent";
import { maskSecret } from "@/domain/technical-settings";
import { ConfigurationForm } from "@/components/configuration-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOllamaStatus } from "@/lib/ollama";
import { loadTechnicalConfig } from "@/lib/technical-settings";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const [config, status] = await Promise.all([loadTechnicalConfig(), getOllamaStatus()]);
  const chatModels = status.models.filter((model) => !isEmbedOnlyModel(model));
  const embedModels = status.models.filter((model) => isEmbedOnlyModel(model));
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Administration technique. Le serveur d’inférence, le type de modèle et la clé d’API se règlent ici. Les fiches métier restent dans les autres menus.
        </p>
      </div>

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
            Modèle de conversation : {status.defaultModel || "aucun pour l’instant"}. Index :{" "}
            {status.embedModel || "aucun pour l’instant"}.
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
            chatModel={config.chatModel}
            embedModel={config.embedModel}
            keyHint={maskSecret(config.apiKey)}
            chatModels={chatModels}
            embedModels={embedModels}
          />
        </CardContent>
      </Card>
    </div>
  );
}
