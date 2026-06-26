import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeSourcePosition from '../utils/rehype-source-position';

/**
 * MarkdownView — renders markdown with full GFM support (tables,
 * strikethrough, task lists, etc.), heading ids via rehype-slug, and
 * syntax-highlighted code blocks. Styled entirely by .prose design tokens.
 */
const PAGE_SCHEME = 'page:';

/* react-markdown strips unknown URL schemes; keep our in-app page links. */
function pageUrlTransform(url) {
  if (url.startsWith(PAGE_SCHEME)) return url;
  return defaultUrlTransform(url);
}

function buildComponents(onNavigate) {
  return {
    /* Task-list checkboxes — match the old hand-rolled style */
    input: ({ type, checked, ...props }) => {
      if (type === 'checkbox') {
        return <input type="checkbox" checked={checked} readOnly style={{ margin: 0 }} {...props} />;
      }
      return <input type={type} {...props} />;
    },
    /* Inline page links (`[Title](page:ID)`) navigate within the app rather
       than following an href. Without a navigator (e.g. public pages) they
       render as plain, non-clickable text. */
    a: ({ href, children, ...props }) => {
      if (href && href.startsWith(PAGE_SCHEME)) {
        const pageId = href.slice(PAGE_SCHEME.length);
        if (!onNavigate) return <span className="nmd-page-ref disabled">{children}</span>;
        return (
          <a
            className="nmd-page-ref"
            href={href}
            onClick={(e) => { e.preventDefault(); onNavigate(pageId); }}
          >
            {children}
          </a>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
  };
}

export default function MarkdownView({ source, onNavigate }) {
  return (
    <div className="nmd-rendered prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSourcePosition, rehypeSlug, rehypeHighlight]}
        urlTransform={pageUrlTransform}
        components={buildComponents(onNavigate)}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
