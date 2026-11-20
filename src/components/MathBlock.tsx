import katex from 'katex';
import { useMemo } from 'react';

interface MathBlockProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export function MathBlock({ latex, displayMode = true, className = '' }: MathBlockProps) {
  const html = useMemo(() => {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  }, [latex, displayMode]);

  return (
    <div
      className={`overflow-x-auto rounded-lg border border-teal-800/70 bg-[#032423] px-4 py-3 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
