/**
 * Curated landing pages built on top of TMDB "discover" queries.
 *
 * Each entry targets a distinct, high-intent query a movie site can realistically
 * rank for ("best movies of 2024", "best 90s movies", "top rated movies"). They
 * are prerendered to static HTML, listed in the sitemap, described in llms.txt
 * and cross-linked from every page, so crawlers get more than a home page plus
 * 200 individual film pages.
 *
 * This module must stay free of Node-only imports: the React pages,
 * `vite.config.js` and the build scripts all read it.
 */

export const TOP_RATED_PATH = '/top-rated';
export const GENRES_INDEX_PATH = '/genres';

const SITE_LABEL = 'Film Point';

/**
 * Years that get their own "Best movies of <year>" page.
 *
 * Curated rather than generated across the full range: a page is only useful if
 * enough notable films were released that year. Add the new year every January.
 */
export const COLLECTION_YEARS = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2010, 2005, 2000,
];

export const DECADES = [
  {
    slug: '2020s',
    label: '2020s',
    start: 2020,
    end: 2029,
    blurb: 'Streaming-era blockbusters, franchise finales and pandemic-era experiments.',
  },
  {
    slug: '2010s',
    label: '2010s',
    start: 2010,
    end: 2019,
    blurb: 'Superhero dominance, prestige spillover and the rise of the auteur sequel.',
  },
  {
    slug: '2000s',
    label: '2000s',
    start: 2000,
    end: 2009,
    blurb: 'Franchise reboots, digital effects coming of age and the golden age of the DVD.',
  },
  {
    slug: '1990s',
    label: '1990s',
    start: 1990,
    end: 1999,
    blurb: 'Indie breakthroughs, blockbuster perfection and the last decade before streaming.',
  },
  {
    slug: '1980s',
    label: '1980s',
    start: 1980,
    end: 1989,
    blurb: 'Practical effects, neon soundtracks and the birth of the modern blockbuster.',
  },
  {
    slug: '1970s',
    label: '1970s',
    start: 1970,
    end: 1979,
    blurb: 'New Hollywood, paranoid thrillers and the movies that redefined American cinema.',
  },
];

export const buildYearPath = (year) => `/year/${year}`;

export const buildDecadePath = (slug) => `/decade/${slug}`;

export const getDecadeBySlug = (slug) =>
  DECADES.find((decade) => decade.slug === slug) || null;

export const isValidCollectionYear = (year) => COLLECTION_YEARS.includes(Number(year));

export const getDecadeForYear = (year) => {
  const value = Number(year);
  if (!Number.isFinite(value)) return null;
  return DECADES.find((decade) => value >= decade.start && value <= decade.end) || null;
};

/**
 * The single description of a collection page: copy, TMDB query and canonical
 * path. Route loaders, pages, the sitemap, llms.txt and the SEO audit all read
 * from here so the surfaces cannot drift apart.
 */
const buildCollection = ({ kind, path, label, heading, title, description, intro, tmdbPath }) => ({
  kind,
  path,
  label,
  heading,
  title,
  description,
  intro,
  tmdbPath,
});

const buildTopRatedCollection = () =>
  buildCollection({
    kind: 'top-rated',
    path: TOP_RATED_PATH,
    label: 'Top rated',
    heading: 'Top Rated Movies of All Time',
    title: `Top Rated Movies of All Time - ${SITE_LABEL}`,
    description:
      'The highest rated movies of all time, ranked by TMDB user scores. Ratings, release years, runtimes and full details for every title on the list.',
    intro:
      'A rating only means something once enough people have voted. This list takes the films with the strongest sustained user scores on TMDB, so one enthusiastic review cannot push a title to the top. Use it when you want a safe pick instead of whatever is trending this week.',
    tmdbPath: '/movie/top_rated?language=en-US&page=1',
  });

const buildYearCollection = (year) =>
  buildCollection({
    kind: 'year',
    path: buildYearPath(year),
    label: String(year),
    heading: `Best Movies of ${year}`,
    title: `Best Movies of ${year} - ${SITE_LABEL}`,
    description: `The most popular movies released in ${year}, ranked by audience activity. Ratings, release dates, runtimes and cast for the ${year} films worth watching.`,
    intro: `${year} in cinema, ranked by what audiences actually watched rather than how loud the marketing was. Every title below was released in ${year} and has enough votes on TMDB for its rating to mean something.`,
    tmdbPath: `/discover/movie?sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=50&include_adult=false&language=en-US`,
  });

const buildDecadeCollection = (decade) =>
  buildCollection({
    kind: 'decade',
    path: buildDecadePath(decade.slug),
    label: `the ${decade.label}`,
    heading: `Best Movies of the ${decade.label}`,
    title: `Best Movies of the ${decade.label} - ${SITE_LABEL}`,
    description: `The best movies of the ${decade.label}, ranked by popularity. ${decade.blurb}`,
    intro: `The ${decade.label} produced more films than anyone can watch, so this list ranks ${decade.start}-${decade.end} by current popularity instead of nostalgia. ${decade.blurb}`,
    tmdbPath: `/discover/movie?sort_by=popularity.desc&primary_release_date.gte=${decade.start}-01-01&primary_release_date.lte=${decade.end}-12-31&vote_count.gte=50&include_adult=false&language=en-US`,
  });

/** Resolves a collection from route params (`/year/:year`, `/decade/:decade`, `/top-rated`). */
export const getCollectionFromParams = (params = {}) => {
  if (params.year !== undefined) {
    const year = Number(params.year);
    return isValidCollectionYear(year) ? buildYearCollection(year) : null;
  }

  if (params.decade !== undefined) {
    const decade = getDecadeBySlug(params.decade);
    return decade ? buildDecadeCollection(decade) : null;
  }

  return buildTopRatedCollection();
};

/** Resolves a collection from an absolute path (used by the build scripts). */
export const getCollectionFromPath = (pathname = '/') => {
  const clean = String(pathname).replace(/\/+$/, '') || '/';

  if (clean === TOP_RATED_PATH) return buildTopRatedCollection();

  const yearMatch = clean.match(/^\/year\/(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return isValidCollectionYear(year) ? buildYearCollection(year) : null;
  }

  const decadeMatch = clean.match(/^\/decade\/([a-z0-9-]+)$/);
  if (decadeMatch) {
    const decade = getDecadeBySlug(decadeMatch[1]);
    return decade ? buildDecadeCollection(decade) : null;
  }

  return null;
};

/** Every prerendered collection page. */
export const COLLECTIONS = [
  buildTopRatedCollection(),
  ...COLLECTION_YEARS.map((year) => buildYearCollection(year)),
  ...DECADES.map((decade) => buildDecadeCollection(decade)),
];

/** Every prerendered collection URL, for SSG + sitemap + llms.txt. */
export const COLLECTION_PATHS = COLLECTIONS.map((collection) => collection.path);

/**
 * Link inventory for the "Browse" dropdowns, so every collection page is one
 * click away from any other page on the site.
 */
export const COLLECTION_LINKS = [
  {
    path: GENRES_INDEX_PATH,
    label: 'All movie genres',
    blurb: 'Every genre hub in one place, from action to western.',
  },
  {
    path: TOP_RATED_PATH,
    label: 'Top rated movies of all time',
    blurb: 'The highest-scoring films on TMDB, ranked by user rating.',
  },
  ...COLLECTION_YEARS.map((year) => ({
    path: buildYearPath(year),
    label: `Best movies of ${year}`,
    blurb: `The most popular films released in ${year}.`,
  })),
  ...DECADES.map((decade) => ({
    path: buildDecadePath(decade.slug),
    label: `Best movies of the ${decade.label}`,
    blurb: decade.blurb,
  })),
];
