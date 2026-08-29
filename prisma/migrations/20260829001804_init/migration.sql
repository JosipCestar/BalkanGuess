-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Song" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedArtist" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "country" TEXT,
    "genre" TEXT,
    "soundcloudTrackId" TEXT,
    "soundcloudUrl" TEXT,
    "previewStart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailySong" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "songId" INTEGER NOT NULL,

    CONSTRAINT "DailySong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Song_active_idx" ON "public"."Song"("active");

-- CreateIndex
CREATE UNIQUE INDEX "DailySong_date_key" ON "public"."DailySong"("date");

-- AddForeignKey
ALTER TABLE "public"."DailySong" ADD CONSTRAINT "DailySong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "public"."Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
