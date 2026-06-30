import React, { useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeSourcePosition from '../utils/rehype-source-position';
import {
  IMAGE_REF_SCHEME, IMAGE_SIZES, resolveImageSrc, parseImageRef, imageMaxWidthForSize,
} from '../lib/uploadImage';

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

/* Rendered image. Always honors the stored display size (so shared pages match
   what the author picked). When `onResize` is provided (in-app preview, not
   public pages), clicking the image opens a small toolbar to pick its size. */
function RenderedImage({ src, alt, onResize, ...props }) {
  const [open, setOpen] = useState(false);
  const { size } = parseImageRef(src);
  const maxWidth = imageMaxWidthForSize(size);
  const style = maxWidth ? { maxWidth } : undefined;
  const url = resolveImageSrc(src);

  if (!onResize) return <img src={url} alt={alt} style={style} {...props} />;

  const pick = (sizeId) => { setOpen(false); onResize(src, sizeId); };

  return (
    <span className={'nmd-img-wrap' + (open ? ' open' : '')} style={style}>
      <img
        src={url}
        alt={alt}
        {...props}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
      />
      {open && (
        <>
          <span className="nmd-img-backdrop" onClick={() => setOpen(false)} />
          <span className="nmd-img-sizes" role="menu">
            {IMAGE_SIZES.map((z) => (
              <button
                key={z.id}
                type="button"
                className={'nmd-img-size-btn' + ((size || 'lg') === z.id ? ' active' : '')}
                onClick={() => pick(z.id)}
              >
                {z.label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

function buildComponents(onNavigate, onResizeImage) {
  return {
    /* Task-list checkboxes — match the old hand-rolled style */
    input: ({ type, checked, ...props }) => {
      if (type === 'checkbox') {
        return <input type="checkbox" checked={checked} readOnly style={{ margin: 0 }} {...props} />;
      }
      return <input type={type} {...props} />;
    },
    /* Resolve opaque `img:<path>` refs to a real Supabase URL at render time
       (legacy full URLs pass through untouched), honoring the stored size and,
       when editable, offering a resize toolbar. */
    img: ({ src, alt, ...props }) => (
      <RenderedImage src={src} alt={alt} onResize={onResizeImage} {...props} />
    ),
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

export default function MarkdownView({ source, onNavigate, onResizeImage }) {
  return (
    <div className="nmd-rendered prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSourcePosition, rehypeSlug, rehypeHighlight]}
        urlTransform={pageUrlTransform}
        components={buildComponents(onNavigate, onResizeImage)}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
