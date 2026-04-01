-- CreateTable
CREATE TABLE "user_onboarding" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "github_connected" BOOLEAN NOT NULL DEFAULT false,
    "first_scan_completed" BOOLEAN NOT NULL DEFAULT false,
    "first_repo_id" TEXT,
    "skipped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_onboarding_user_id_key" ON "user_onboarding"("user_id");

-- CreateIndex
CREATE INDEX "user_onboarding_user_id_idx" ON "user_onboarding"("user_id");

-- AddForeignKey
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
