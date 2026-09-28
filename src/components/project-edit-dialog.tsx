"use client";

import { Pencil } from "lucide-react";
import { deleteProjectAction, deleteQuoteAction, updateProjectAction } from "@/app/catalog-actions";
import { ProjectEditor } from "@/components/project-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProjectEditDialog({
  project,
  clients,
  quotes,
}: {
  project: { id: string; name: string; clientId: string; status: string; purpose: string; nextAction: string };
  clients: Array<{ id: string; name: string }>;
  quotes: Array<{ id: string; label: string }>;
}) {
  return (
    <Dialog>
      <DialogTrigger className={buttonVariants({ variant: "outline" })}>
        <Pencil aria-hidden="true" className="size-3.5" />
        Modifier
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier le dossier</DialogTitle>
          <DialogDescription>Nom, client, statut, objet et prochaine action. L’enregistrement est tracé dans Événements.</DialogDescription>
        </DialogHeader>
        <ProjectEditor
          project={project}
          clients={clients}
          quotes={quotes}
          updateAction={updateProjectAction}
          deleteAction={deleteProjectAction}
          deleteQuoteAction={deleteQuoteAction}
        />
      </DialogContent>
    </Dialog>
  );
}
