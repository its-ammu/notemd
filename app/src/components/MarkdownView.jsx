import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeSourcePosition from '../utils/rehype-source-position';
import { IMAGE_REF_SCHEME, resolveImageSrc } from '../lib/uploadImage';

/**
 * MarkdownView — renders markdown with full GFM support (tables,
 * strikethrough, task lists, etc.), heading ids via rehype-slug, and
 * syntax-highlighted code blocks. Styled entirely by .prose design tokens.
 */
const PAGE_SCHEME = 'page:';

/* react-markdown strips unknown URL schemes; keep our in-app page links and
   opaque image refs (both resolved later in `components`). */
function pageUrlTransform(url) {
  if (url.startsWith(PAGE_SCHEME) || url.startsWith(IMAGE_REF_SCHEME)) return url;
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
    /* Resolve opaque `img:<path>` refs to a real Supabase URL at render time
       (legacy full URLs pass through untouched). */
    img: ({ src, ...props }) => <img src={resolveImageSrc(src)} {...props} />,
    /* Inline page links (`[Title](page:ID)`) navigate within the app rather
       than following an href. Without a navigator (e.g. public pages) they
       render as plain, non-clickable text. */
    a: ({ href, children, ...props }) => {
      if (href && href.startsWith(PAGE_SCHEME)) {
        const pageId = href.slice(PAGE_SCHEME.length);
        if (!onNavigate) {
          return (
            <span className="nmd-page-ref disabled">
              <span className="nmd-page-ref-at" aria-hidden="true">@</span>{children}
            </span>
          );
        }
        return (
          <a
            className="nmd-page-ref"
            href={href}
            onClick={(e) => { e.preventDefault(); onNavigate(pageId); }}
          >
            <span className="nmd-page-ref-at" aria-hidden="true">@</span>{children}
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
