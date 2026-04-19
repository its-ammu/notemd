// Minimal markdown renderer — ported from the NoteMD UI kit
function renderInline(text) {
  const parts = []; let last = 0, m, i = 0;
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('`')) parts.push(React.createElement('code', { key: i++ }, t.slice(1, -1)));
    else if (t.startsWith('**')) parts.push(React.createElement('strong', { key: i++ }, t.slice(2, -2)));
    else if (t.startsWith('*')) parts.push(React.createElement('em', { key: i++ }, t.slice(1, -1)));
    else if (t.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      parts.push(React.createElement('a', { key: i++, href: mm[2] }, mm[1]));
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MarkdownView({ source }) {
  const lines = source.split('\n'); const out = []; let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length; const Tag = 'h' + level;
      out.push(<Tag key={k++}>{renderInline(line.replace(/^#+ /, ''))}</Tag>); i++;
    } else if (line.startsWith('> ')) {
      const buf = []; while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      out.push(<blockquote key={k++}>{renderInline(buf.join(' '))}</blockquote>);
    } else if (line.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; out.push(<pre key={k++}><code>{buf.join('\n')}</code></pre>);
    } else if (/^- \[[ x]\] /.test(line)) {
      const buf = []; while (i < lines.length && /^- \[[ x]\] /.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(<ul key={k++} style={{ listStyle: 'none', paddingLeft: 0 }}>{buf.map((b, j) => {
        const checked = b[3] === 'x';
        return <li key={j} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <input type="checkbox" checked={checked} readOnly style={{ margin: 0 }} />
          <span style={checked ? { color: 'var(--fg3)', textDecoration: 'line-through' } : null}>{renderInline(b.slice(6))}</span>
        </li>;
      })}</ul>);
    } else if (/^- /.test(line)) {
      const buf = []; while (i < lines.length && /^- /.test(lines[i])) { buf.push(lines[i].slice(2)); i++; }
      out.push(<ul key={k++}>{buf.map((b, j) => <li key={j}>{renderInline(b)}</li>)}</ul>);
    } else if (/^\d+\. /.test(line)) {
      const buf = []; while (i < lines.length && /^\d+\. /.test(lines[i])) { buf.push(lines[i].replace(/^\d+\. /, '')); i++; }
      out.push(<ol key={k++}>{buf.map((b, j) => <li key={j}>{renderInline(b)}</li>)}</ol>);
    } else if (line.trim() === '') { i++; }
    else if (/^---+$/.test(line.trim())) { out.push(<hr key={k++} />); i++; }
    else {
      const buf = [line]; i++;
      while (i < lines.length && lines[i].trim() !== '' && !/^(#|>|-|\d+\.|`)/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(<p key={k++}>{renderInline(buf.join(' '))}</p>);
    }
  }
  return <div className="nmd-rendered prose">{out}</div>;
}

window.MarkdownView = MarkdownView;
