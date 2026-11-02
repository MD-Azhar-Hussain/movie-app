import React from 'react';
import { Link } from 'react-router-dom';
import { COLLECTION_LINKS } from '../lib/collections';

/**
 * Cross-links to the collection pages (top rated, release years, decades).
 *
 * Rendered as a native <details> disclosure so the anchors stay in the
 * prerendered HTML — crawlers still see every link — while the reader is not
 * greeted with thirty rows of navigation. No JavaScript is required.
 */
const CollectionLinks = ({ currentPath = null, title = 'Browse by release year', excludeKinds = [] }) => {
  const items = COLLECTION_LINKS.filter(
    (item) => item.path !== currentPath && !excludeKinds.some((prefix) => item.path.startsWith(prefix))
  );
  if (items.length === 0) return null;

  return (
    <details className="link-dropdown">
      <summary className="link-dropdown-summary">
        <span className="link-dropdown-copy">
          <span className="link-dropdown-eyebrow">Curated lists</span>
          <h2 className="link-dropdown-title">{title}</h2>
        </span>
        <span className="link-dropdown-count">{items.length} pages</span>
        <span className="link-dropdown-chevron" aria-hidden="true" />
      </summary>

      <div className="link-dropdown-body">
        <nav aria-label={title}>
          <ul className="link-grid">
            {items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </details>
  );
};

export default CollectionLinks;
