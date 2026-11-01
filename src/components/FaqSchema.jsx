import React from 'react';

/**
 * FAQPage structured data. Google now limits FAQ rich results to a small set
 * of authoritative sites, but the markup still makes the Q&A explicit for AI
 * crawlers and assistants that parse schema.org data.
 */
const FaqSchema = ({ items }) => {
  const questions = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.question && item.answer
  );

  if (questions.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default FaqSchema;
