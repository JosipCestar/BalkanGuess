import { normalizeBalkanText } from "./text";

const COLLABORATOR_SEPARATOR = /\s+(?:x|i|and|feat|featuring|ft)\s+|\s*&\s*/;

export function parseArtistCredits(value: string) {
  return [...new Set(
    normalizeBalkanText(value.replace(/[&+]/g, " x "))
      .split(COLLABORATOR_SEPARATOR)
      .map(artist => artist.trim())
      .filter(Boolean),
  )];
}

export function haveMatchingArtistCredit(first: string, second: string) {
  const firstArtists = new Set(parseArtistCredits(first));
  return parseArtistCredits(second).some(artist => firstArtists.has(artist));
}
