import React, { useState } from 'react';
import { tagStyle } from '../../shared/utils/tags';

export default function TagInput({ allTags, existing, onAdd, onRemoveLast }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [hi, setHi] = useState(0);

  const existingSet = new Set((existing || []).map(t => t.toLowerCase()));
  const q = value.trim().toLowerCase();
  const suggestions = allTags.filter(t => !existingSet.has(t) && (!q || t.includes(q))).slice(0, 6);
  const showCreate = !!q && !existingSet.has(q) && !allTags.includes(q);
  const optionCount = suggestions.length + (showCreate ? 1 : 0);
  const open = focused && optionCount > 0;
  const sel = optionCount > 0 ? Math.min(hi, optionCount - 1) : 0;

  const commit = (tag) => {
    const t = (tag || '').trim().toLowerCase();
    if (t && !existingSet.has(t)) onAdd(t);
    setValue('');
    setHi(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); setHi((sel + 1) % optionCount); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setHi((sel - 1 + optionCount) % optionCount); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && sel < suggestions.length) commit(suggestions[sel]);
      else commit(value);
    }
    else if (e.key === ',') { e.preventDefault(); commit(value); }
    else if (e.key === 'Escape') { e.target.blur(); }
    else if (e.key === 'Backspace' && value === '') { onRemoveLast(); }
  };

  return (
    <div className="nmd-tag-input-wrap">
      <input
        className="nmd-tag-input"
        placeholder="+ Add tag"
        value={value}
        onChange={e => { setValue(e.target.value); setHi(0); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="nmd-tag-suggest" role="listbox">
          {suggestions.map((t, i) => (
            <button
              key={t}
              className={'nmd-tag-suggest-item' + (i === sel ? ' hi' : '')}
              onMouseDown={e => { e.preventDefault(); commit(t); }}
              onMouseEnter={() => setHi(i)}
            >
              <span className="nmd-tag-dot" style={tagStyle(t)} />
              {t}
            </button>
          ))}
          {showCreate && (
            <button
              className={'nmd-tag-suggest-item create' + (sel === suggestions.length ? ' hi' : '')}
              onMouseDown={e => { e.preventDefault(); commit(q); }}
              onMouseEnter={() => setHi(suggestions.length)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              Create &ldquo;{q}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
