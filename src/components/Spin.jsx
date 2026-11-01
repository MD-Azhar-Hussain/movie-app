import React from 'react';

/**
 * Lightweight loading indicator.
 *
 * This used to wrap Flowbite's `Button` + `Spinner`, which pulled the entire
 * flowbite-react runtime into the client bundle for one spinner (Lighthouse
 * flagged ~140 KB of unused JavaScript). A CSS-only ring renders the same and
 * costs nothing, and the animation is transform-based so it stays composited.
 */
const Spin = () => (
  <div className="spin-loader" role="status" aria-live="polite">
    <span className="spin-ring" aria-hidden="true" />
    <span className="spin-label">Loading movies...</span>
  </div>
);

export { Spin };
export default Spin;
