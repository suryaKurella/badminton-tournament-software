-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_tournament_id_fkey";

-- DropForeignKey
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_tournament_id_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_tournament_id_fkey";

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "matches_tournament_id_idx" ON "matches"("tournament_id");

-- CreateIndex
CREATE INDEX "matches_match_status_idx" ON "matches"("match_status");

-- CreateIndex
CREATE INDEX "matches_scheduled_time_idx" ON "matches"("scheduled_time");

-- CreateIndex
CREATE INDEX "matches_team1_id_idx" ON "matches"("team1_id");

-- CreateIndex
CREATE INDEX "matches_team2_id_idx" ON "matches"("team2_id");

-- CreateIndex
CREATE INDEX "matches_tournament_id_match_status_idx" ON "matches"("tournament_id", "match_status");

-- CreateIndex
CREATE INDEX "matches_tournament_id_round_idx" ON "matches"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "registrations_user_id_idx" ON "registrations"("user_id");

-- CreateIndex
CREATE INDEX "registrations_tournament_id_idx" ON "registrations"("tournament_id");

-- CreateIndex
CREATE INDEX "registrations_registration_status_idx" ON "registrations"("registration_status");

-- CreateIndex
CREATE INDEX "registrations_payment_status_idx" ON "registrations"("payment_status");

-- CreateIndex
CREATE INDEX "teams_tournament_id_idx" ON "teams"("tournament_id");

-- CreateIndex
CREATE INDEX "teams_player1_id_idx" ON "teams"("player1_id");

-- CreateIndex
CREATE INDEX "teams_player2_id_idx" ON "teams"("player2_id");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_tournament_type_idx" ON "tournaments"("tournament_type");

-- CreateIndex
CREATE INDEX "tournaments_start_date_idx" ON "tournaments"("start_date");

-- CreateIndex
CREATE INDEX "tournaments_created_by_id_idx" ON "tournaments"("created_by_id");

-- CreateIndex
CREATE INDEX "tournaments_status_start_date_idx" ON "tournaments"("status", "start_date");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
