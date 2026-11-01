import React from 'react';
import { Link } from 'react-router-dom';
import { SITE_NAME } from '../lib/seo';

/**
 * Small, shared site footer: brand, quick links, a compact FAQ and the
 * disclaimer.
 *
 * The FAQ is a native <details> disclosure so it costs one line of vertical
 * space until opened, and no FAQPage JSON-LD is emitted here — movie pages
 * already publish their own FAQPage, and a second one per page would be
 * conflicting structured data.
 */
const FAQ_ITEMS = [
  {
    question: 'Is Film Point free?',
    answer: 'Yes. Browsing, searching and the watchlist are free and need no account.',
  },
  {
    question: 'Where does the data come from?',
    answer: 'Movie details, posters and ratings come from TMDB. Ratings are TMDB user scores, not ours.',
  },
  {
    question: 'Does Film Point stream or host films?',
    answer: 'No. We only link out to third-party sites and never host or stream video files.',
  },
  {
    question: 'Where is my watchlist saved?',
    answer: 'In your browser (localStorage) on this device, with optional background sync if enabled.',
  },
];

const SiteFooter = () => (
  <footer className="site-footer" aria-label={`${SITE_NAME} footer`}>
    <div className="site-footer-inner">
      <div className="site-footer-top">
        <p className="site-footer-brand">
          {SITE_NAME}
          <span>Movie discovery, ratings and watchlists.</span>
        </p>

        <nav className="site-footer-nav" aria-label="Footer links">
          <Link to="/">Discover</Link>
          <Link to="/#watchlist">Watchlist</Link>
          <Link to="/#trending">Trending</Link>
          <Link to="/genre/action">Genres</Link>
        </nav>
      </div>

      <details className="site-footer-faq">
        <summary>FAQ</summary>
        <dl>
          {FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="site-footer-disclaimer">
        <strong>Disclaimer:</strong> {SITE_NAME} is an independent movie discovery project, not affiliated with,
        endorsed by or certified by TMDB, IMDb or any studio. Metadata and posters are provided by TMDB and may be
        incomplete or out of date. We do not host, stream or sell films — “Watch” and “Download” buttons open
        third-party sites we do not control and are not responsible for. Trademarks belong to their respective owners.
      </p>

      <div className="site-footer-bottom">
        <span>© 2026 {SITE_NAME}. All rights reserved.</span>
        <span>
          Data by{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
            TMDB
          </a>
        </span>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
