-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER', 'PLAYER', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('SINGLES', 'DOUBLES', 'MIXED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLIST');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT,
    "phone_number" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "max_participants" INTEGER NOT NULL,
    "tournament_type" "TournamentType" NOT NULL,
    "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "player1_id" TEXT NOT NULL,
    "player2_id" TEXT NOT NULL,
    "team_name" TEXT,
    "seed_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "court_number" INTEGER,
    "match_status" "MatchStatus" NOT NULL DEFAULT 'UPCOMING',
    "scheduled_time" TIMESTAMP(3),
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "team1_id" TEXT NOT NULL,
    "team2_id" TEXT NOT NULL,
    "team1_score" JSONB,
    "team2_score" JSONB,
    "winner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_user_id_tournament_id_key" ON "registrations"("user_id", "tournament_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
