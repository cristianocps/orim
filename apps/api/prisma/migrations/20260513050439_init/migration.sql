-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('owner', 'editor', 'viewer');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_members" (
    "id" UUID NOT NULL,
    "role" "BoardRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elements" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "transform" JSONB NOT NULL,
    "style" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "boardId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "history" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "manifest" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" UUID NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "entryPoint" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appId" UUID NOT NULL,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_installs" (
    "id" UUID NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appId" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "installedBy" UUID NOT NULL,

    CONSTRAINT "app_installs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_boardId_userId_key" ON "board_members"("boardId", "userId");

-- CreateIndex
CREATE INDEX "elements_boardId_idx" ON "elements"("boardId");

-- CreateIndex
CREATE INDEX "elements_boardId_deletedAt_idx" ON "elements"("boardId", "deletedAt");

-- CreateIndex
CREATE INDEX "history_boardId_createdAt_idx" ON "history"("boardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_appId_version_key" ON "app_versions"("appId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "app_installs_appId_boardId_key" ON "app_installs"("appId", "boardId");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_installs" ADD CONSTRAINT "app_installs_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_installs" ADD CONSTRAINT "app_installs_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_installs" ADD CONSTRAINT "app_installs_installedBy_fkey" FOREIGN KEY ("installedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
