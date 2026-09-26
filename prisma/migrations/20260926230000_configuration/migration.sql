CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'local',
    "serverUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "chatModel" TEXT NOT NULL DEFAULT '',
    "embedModel" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
