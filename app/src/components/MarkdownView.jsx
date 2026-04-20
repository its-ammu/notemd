import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeSourcePosition from '../utils/rehype-source-position';

/**
 * MarkdownView — renders markdown with full GFM support (tables,
 * strikethrough, task lists, etc.), heading ids via rehype-slug, and
 * syntax-highlighted code blocks. Styled entirely by .prose design tokens.
 */
const components = {
  /* Task-list checkboxes — match the old hand-rolled style */
  input: ({ type, checked, ...props }) => {
    if (type === 'checkbox') {
      return <input type="checkbox" checked={checked} readOnly style={{ margin: 0 }} {...props} />;
    }
    return <input type={type} {...props} />;
  },
};

export default function MarkdownView({ source }) {
  return (
    <div className="nmd-rendered prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSourcePosition, rehypeSlug, rehypeHighlight]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
