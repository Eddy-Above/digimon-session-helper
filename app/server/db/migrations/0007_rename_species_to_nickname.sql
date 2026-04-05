ALTER TABLE "digimon" RENAME COLUMN "species" TO "nickname";
ALTER TABLE "digimon" ALTER COLUMN "nickname" DROP NOT NULL;
