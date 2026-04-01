-- CreateTable
CREATE TABLE "oauth_states" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "session_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");
