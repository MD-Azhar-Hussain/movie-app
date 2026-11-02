import React from 'react';

/**
 * Renders structured data as a single JSON-LD block.
 *
 * Emitting one `@graph` per page instead of five separate <script> tags keeps
 * the head small and lets `@id` references resolve across nodes.
 */
const JsonLd = ({ data }) => {
  if (!data) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // Escape `<` so a movie title containing "</script>" cannot break out of
        // the JSON-LD block.
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
};

export default JsonLd;
