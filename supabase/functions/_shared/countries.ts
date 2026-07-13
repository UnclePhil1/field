const NAME_TO_ISO2: Record<string, string> = {
  argentina: 'ar', australia: 'au', austria: 'at', belgium: 'be',
  'bosnia & herzegovina': 'ba', 'bosnia and herzegovina': 'ba', brazil: 'br',
  cameroon: 'cm', canada: 'ca', 'cape verde': 'cv', chile: 'cl', colombia: 'co',
  'congo dr': 'cd', 'dr congo': 'cd', 'costa rica': 'cr', croatia: 'hr',
  denmark: 'dk', ecuador: 'ec', egypt: 'eg', england: 'gb-eng', france: 'fr',
  germany: 'de', ghana: 'gh', greece: 'gr', honduras: 'hn', hungary: 'hu',
  iceland: 'is', iran: 'ir', 'ivory coast': 'ci', "cote d'ivoire": 'ci',
  italy: 'it', jamaica: 'jm', japan: 'jp', mexico: 'mx', morocco: 'ma',
  myanmar: 'mm', netherlands: 'nl', 'new zealand': 'nz', nigeria: 'ng',
  'north macedonia': 'mk', norway: 'no', panama: 'pa', paraguay: 'py',
  peru: 'pe', poland: 'pl', portugal: 'pt', qatar: 'qa',
  'republic of ireland': 'ie', ireland: 'ie', romania: 'ro', russia: 'ru',
  'saudi arabia': 'sa', scotland: 'gb-sct', senegal: 'sn', serbia: 'rs',
  slovakia: 'sk', slovenia: 'si', 'south africa': 'za', 'south korea': 'kr',
  'korea republic': 'kr', spain: 'es', sweden: 'se', switzerland: 'ch',
  tunisia: 'tn', turkey: 'tr', 'türkiye': 'tr', ukraine: 'ua', uruguay: 'uy',
  usa: 'us', 'united states': 'us', 'united states of america': 'us',
  uzbekistan: 'uz', venezuela: 've', vietnam: 'vn', wales: 'gb-wls',
};

export function countryToIso2(name: string): string | null {
  return NAME_TO_ISO2[name?.trim().toLowerCase()] ?? null;
}
