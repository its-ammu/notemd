import { visit } from 'unist-util-visit';

/**
 * Rehype plugin that copies each element's markdown source line onto a
 * `data-source-line` attribute. Used to map rendered blocks back to their
 * position in the textarea for cursor-based navigation.
 */
export default function rehypeSourcePosition() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      const line = node.position?.start?.line;
      if (!line) return;
      node.properties = node.properties || {};
      node.properties.dataSourceLine = String(line);
    });
  };
}
