import { PrismaClient } from "@prisma/client";
import { normalizeBalkanText } from "../lib/text";
const prisma = new PrismaClient();
const songs = [
  ["Gianni", "Jala Brat", "Bosnia and Herzegovina", "268854633", "https://soundcloud.com/imperia_official/jala-brat-gianni-official"],
  ["O.D.D.D", "Jala Brat", "Bosnia and Herzegovina", "678298641", "https://soundcloud.com/imperia_official/jala-brat-oddd"],
  ["To Me Radi", "Maya Berović", "Bosnia and Herzegovina", "272701026", "https://soundcloud.com/mayaberovicofficial/maya-berovic-to-me-radi-feat"],
  ["Perverzija", "Bilzerian Pablo", "Serbia", "832280857", "https://soundcloud.com/muzicar_production/perverzija-bilzerian-pablo-mp3cutnet"],
  ["Sporije", "Buba Corelli", "Bosnia and Herzegovina", "291345967", "https://soundcloud.com/imperia_official/buba-corelli-sporije"],
  ["Toplica i Vlasina", "Coby x Benzika", "Serbia", "2254737800", "https://soundcloud.com/hhaarree99/coby-x-benzika-toplica-i"],
  ["Zločin Bez Dokaza", "Tanja Savić feat. Corona x Rimski", "Serbia", "1549846249", "https://soundcloud.com/mihnea-nicolae-s-r-cil/tanja-savi-feat-corona-x-1"],
  ["Fetis", "Buba Corelli", "Bosnia and Herzegovina", "268919898", "https://soundcloud.com/imperia_official/buba-corelli-fetis-official-novo"],
  ["Noćas Nisam Tvoj", "Corona x Rimski", "Serbia", "410483568", "https://soundcloud.com/kdmexclusive/nocas-nisam-tvoj"],
  ["Da Li Si Me", "Jala Brat x Buba Corelli", "Bosnia and Herzegovina", "1499582854", "https://soundcloud.com/talentmusicrs/jala-brat-x-buba-corelli-da-li"],
  ["Dominantna", "Jala Brat x Dado Polumenta", "Bosnia and Herzegovina", "269941804", "https://soundcloud.com/imperia_official/jala-brat-x-dado-polumenta-dominantna-official-2016"],
  ["Gad", "Rimski x Corona", "Serbia", "1549846450", "https://soundcloud.com/mihnea-nicolae-s-r-cil/rimski-x-corona-gad"],
  ["Heineken", "Vuk Mob feat. Coby", "Serbia", "431216172", "https://soundcloud.com/djovani24/vuk-mob-feat-coby-heineken-mshr-remix"],
  ["Stari Radio", "Jala Brat & Buba Corelli", "Bosnia and Herzegovina", "268661047", "https://soundcloud.com/imperia_official/jala-brat-buba-corelli-stari-radio"],
  ["Gadafi", "Maus Maki", "Bosnia and Herzegovina", "272876342", "https://soundcloud.com/maus-maki-didzej/maus-maki-gadafi"],
  ["Playboy", "Corona", "Serbia", "1221694642", "https://soundcloud.com/princeboy91/corona-playboy"],
  ["Restart", "Jala Brat", "Bosnia and Herzegovina", "291983429", "https://soundcloud.com/imperia_official/jala-brat-restart"],
  ["Superstar", "Seksi", "Serbia", "1644869952", "https://soundcloud.com/death-race-979688627/seksi-superstar"],
  ["Hmoschino", "Coby", "Serbia", "2064006316", "https://soundcloud.com/hhaarree99/coby-hmoschino"],
  ["Mlada i Luda", "Jala Brat", "Bosnia and Herzegovina", "355594946", "https://soundcloud.com/imperia_official/jala-brat-mlada-i-luda-official"],
  ["Zatvaranje", "Elena Kitić feat. Buba Corelli", "Serbia", "2049868600", "https://soundcloud.com/user-92303905-911209832/elena-kitic-feat-buba-corelli"],
  ["Milion Dolara", "Nikolija feat. Ana Nikolić", "Serbia", "167715118", "https://soundcloud.com/nikolijaofficial/nikolija-milion-dolara-ft-ana"],
  ["Bad", "Jala Brat", "Bosnia and Herzegovina", "320185387", "https://soundcloud.com/imperia_official/jala-brat-bad-official"],
  ["Blinda", "Mili x Lacku x Biba", "Serbia", "1193222104", "https://soundcloud.com/tonyjackmusic/mili-x-lacku-x-biba-blinda-tony-jack-live-mashup"],
  ["Ignor", "Sajfer x Cunami", "Bosnia and Herzegovina", "1277346382", "https://soundcloud.com/talentmusicrs/sajfer-x-cunami-ignor"],
  ["99", "Jala Brat", "Bosnia and Herzegovina", "678300102", "https://soundcloud.com/imperia_official/jala-brat-99"],
  ["Nemačka", "Petrov", "Serbia", "1551963820", "https://soundcloud.com/death-race-979688627/petrov-nema-ka"],
  ["Odakle Sam Ja", "Coby i Rimski", "Serbia", "1113014284", "https://soundcloud.com/user-317354182-445836815/coby-i-rimski-odakle-sam-ja"],
  ["Monika", "Jala Brat", "Bosnia and Herzegovina", "678300681", "https://soundcloud.com/imperia_official/jala-brat-monika"],
  ["200 Na Sat", "Coby x Klinac", "Serbia", "1058955475", "https://soundcloud.com/milo-mrkonji-830322961/coby-x-klinac-200-na-sat"]
] as const;
async function main() {
  for (const [index, [title, artist, country, soundcloudTrackId, soundcloudUrl]] of songs.entries()) {
    const values = { title, artist, country, genre: "Balkan pop / hip-hop", normalizedTitle: normalizeBalkanText(title), normalizedArtist: normalizeBalkanText(artist), previewStart: 30, soundcloudTrackId, soundcloudUrl };
    await prisma.song.upsert({ where: { id: index + 1 }, update: values, create: values });
  }
  const dailySongs: Array<[string, number]> = [["2026-08-27", 1], ["2026-08-28", 2], ["2026-08-29", 3], ["2026-08-30", 4]];
  for (const [date, songId] of dailySongs) await prisma.dailySong.upsert({ where: { date_category: { date, category: "legacy" } }, update: { songId }, create: { date, songId, category: "legacy" } });
}
main().finally(() => prisma.$disconnect());
