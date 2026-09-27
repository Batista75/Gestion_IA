CREATE TABLE "AssistantTask" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantTask_conversationId_key" ON "AssistantTask"("conversationId");

ALTER TABLE "AssistantTask" ADD CONSTRAINT "AssistantTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
