/**
 * Canonical TMDB movie genres used for topical hub pages (`/genre/:slug`).
 *
 * These pages target specific long-tail intent ("best action movies to watch
 * right now") instead of competing for the impossibly broad head term "movies".
 */
export const GENRES = [
  {
    id: 28,
    name: 'Action',
    slug: 'action',
    blurb: 'Explosive chases, fight choreography and high-stakes set pieces.',
    intro: 'Action movies live or die by momentum. This page ranks the most popular action films right now, so you can pick something with real stunt work instead of scrolling an endless feed.',
  },
  {
    id: 12,
    name: 'Adventure',
    slug: 'adventure',
    blurb: 'Quests, treasure hunts and journeys into the unknown.',
    intro: 'Adventure films trade realism for scale: new worlds, dangerous expeditions and a hero who has to keep moving. Below are the adventure titles audiences are watching most this week.',
  },
  {
    id: 16,
    name: 'Animation',
    slug: 'animation',
    blurb: 'Hand-drawn, stop-motion and CGI storytelling for every age.',
    intro: 'Animation is a technique, not a genre, which is why the range here spans family favourites and adult drama. These are the most popular animated features right now.',
  },
  {
    id: 35,
    name: 'Comedy',
    slug: 'comedy',
    blurb: 'Big-screen sitcoms, satire and feel-good laughs.',
    intro: 'Comedy is the hardest genre to recommend because taste varies wildly. This list uses current popularity rather than critical scores, so you get films people are actually laughing at now.',
  },
  {
    id: 80,
    name: 'Crime',
    slug: 'crime',
    blurb: 'Heists, mobsters, detectives and the wrong side of the law.',
    intro: 'Crime films put ordinary people under extraordinary pressure. From procedural investigations to gangster epics, these are the crime titles drawing the most attention at the moment.',
  },
  {
    id: 99,
    name: 'Documentary',
    slug: 'documentary',
    blurb: 'True stories, investigations and real-world reporting.',
    intro: 'Documentaries are the fastest way to learn something specific in 90 minutes. The list below highlights the nonfiction films currently getting the most views and discussion.',
  },
  {
    id: 18,
    name: 'Drama',
    slug: 'drama',
    blurb: 'Character studies, family sagas and emotional weight.',
    intro: 'Drama is the broadest category in cinema, covering everything from courtroom stories to quiet character pieces. These are the most popular dramatic films on TMDB right now.',
  },
  {
    id: 10751,
    name: 'Family',
    slug: 'family',
    blurb: 'Films that genuinely work for kids and adults together.',
    intro: 'Family movies have to keep a five-year-old and a forty-year-old equally engaged, which is a much harder brief than it sounds. Here are the family titles currently ranking highest.',
  },
  {
    id: 14,
    name: 'Fantasy',
    slug: 'fantasy',
    blurb: 'Magic systems, myth and invented worlds.',
    intro: 'Fantasy asks you to accept a new set of rules for two hours. From portal adventures to dark fairy tales, these are the fantasy films audiences are watching most.',
  },
  {
    id: 36,
    name: 'History',
    slug: 'history',
    blurb: 'Period epics, war rooms and real events on screen.',
    intro: 'Historical films turn the record into drama, sometimes accurately and sometimes not. This list covers the period pieces currently drawing the biggest audiences.',
  },
  {
    id: 27,
    name: 'Horror',
    slug: 'horror',
    blurb: 'Hauntings, slashers, folk horror and psychological dread.',
    intro: 'Horror is the most efficient genre in cinema: low budget, high impact. These are the scary movies trending right now, from slow-burn dread to outright gore.',
  },
  {
    id: 10402,
    name: 'Music',
    slug: 'music',
    blurb: 'Biopics, concert films and stage musicals.',
    intro: 'Music films sit between performance and narrative. Whether it is a tour documentary or a full-blown musical, these are the music titles getting the most plays today.',
  },
  {
    id: 9648,
    name: 'Mystery',
    slug: 'mystery',
    blurb: 'Whodunits, puzzles and slow reveals.',
    intro: 'A good mystery gives you enough clues to feel clever and enough misdirection to be surprised. These are the mystery films currently ranking highest with audiences.',
  },
  {
    id: 10749,
    name: 'Romance',
    slug: 'romance',
    blurb: 'Love stories, slow burns and breakups.',
    intro: 'Romance works when the two leads are worth rooting for. From classic melodrama to modern rom-coms, this is what viewers are falling for right now.',
  },
  {
    id: 878,
    name: 'Science Fiction',
    slug: 'science-fiction',
    blurb: 'Space, AI, time travel and speculative futures.',
    intro: 'Science fiction is the genre of ideas: it changes one rule and follows it to the end. These are the most popular sci-fi films at the moment, ranked by audience activity.',
  },
  {
    id: 53,
    name: 'Thriller',
    slug: 'thriller',
    blurb: 'Tension, paranoia and ticking clocks.',
    intro: 'Thrillers are engineered for stress: a countdown, a secret, someone who should not be trusted. Below are the thriller titles with the most traction right now.',
  },
  {
    id: 10752,
    name: 'War',
    slug: 'war',
    blurb: 'Combat films, home fronts and the cost of conflict.',
    intro: 'War films range from large-scale battle recreations to intimate survival stories. These are the war movies currently most watched on Film Point.',
  },
  {
    id: 37,
    name: 'Western',
    slug: 'western',
    blurb: 'Frontier justice, standoffs and modern reinventions.',
    intro: 'The western is cinema\'s oldest genre and still gets reinvented every decade. Here are the frontier stories audiences are watching today.',
  },
  {
    id: 10770,
    name: 'TV Movie',
    slug: 'tv-movie',
    blurb: 'Feature-length stories made for television.',
    intro: 'TV movies cover everything from prestige one-offs to franchise pilots. These are the ones currently getting the most attention on Film Point.',
  },
];

export const getGenreBySlug = (slug) =>
  GENRES.find((genre) => genre.slug === slug) || null;

export const getGenreById = (id) =>
  GENRES.find((genre) => Number(genre.id) === Number(id)) || null;

export const getGenreSlugById = (id) => getGenreById(id)?.slug || null;

export const GENRE_PATHS = GENRES.map((genre) => `/genre/${genre.slug}`);

export default GENRES;

