import React from 'react';
import { Head } from 'vite-react-ssg';
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  ROBOTS_INDEX,
  SITE_NAME,
} from '../lib/seo';

/**
 * One canonical <head> for every page.
 *
 * Before this existed each page hand-wrote its own meta block, which is how the
 * genre hubs ended up without an `og:image` and why `robots` directives drifted
 * between pages. Everything search engines and social crawlers need is emitted
 * here: title, description, canonical, hreflang, robots, Open Graph and the
 * Twitter card.
 *
 * `children` renders extra tags (article times, geo tags, …) inside the same
 * <Head> so the SSG output stays in one block.
 */
const SeoHead = ({
  title,
  description,
  canonicalPath = '/',
  canonicalUrl,
  image = DEFAULT_OG_IMAGE,
  imageAlt = OG_IMAGE_ALT,
  type = 'website',
  robots = ROBOTS_INDEX,
  children,
}) => {
  const url = canonicalUrl || absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(image);
  // The generated site image is a fixed 1200x630; TMDB artwork is not, and
  // declaring the wrong dimensions makes some crawlers reject the image.
  const isDefaultImage = imageUrl === DEFAULT_OG_IMAGE;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />
      <meta name="robots" content={robots} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={imageAlt} />
      {isDefaultImage ? (
        <>
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
          <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
        </>
      ) : null}
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {children}
    </Head>
  );
};

export default SeoHead;
