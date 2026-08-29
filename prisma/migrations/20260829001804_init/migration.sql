-- CreateTable
CREATE TABLE "Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedArtist" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "country" TEXT,
    "genre" TEXT,
    "soundcloudTrackId" TEXT,
    "soundcloudUrl" TEXT,
    "previewStart" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailySong" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "songId" INTEGER NOT NULL,
    CONSTRAINT "DailySong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Song_active_idx" ON "Song"("active");

-- CreateIndex
CREATE UNIQUE INDEX "DailySong_date_key" ON "DailySong"("date");
