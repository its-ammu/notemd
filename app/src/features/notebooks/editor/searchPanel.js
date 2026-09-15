import {
  closeSearchPanel, findNext, findPrevious, getSearchQuery, SearchQuery, setSearchQuery,
} from '@codemirror/search';

/* Minimal custom search panel */
export function createSearchPanel(view) {
  const dom = document.createElement('div');
  dom.className = 'nmd-search-panel';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Find...';
  input.className = 'nmd-search-input';

  const query = getSearchQuery(view.state);
  input.value = query.search || '';

  const updateSearch = () => {
    const newQuery = new SearchQuery({ search: input.value, caseSensitive: false });
    view.dispatch({ effects: setSearchQuery.of(newQuery) });
  };

  input.addEventListener('input', updateSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext(view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    }
  });

  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>';
  prevBtn.title = 'Previous (Shift+Enter)';
  prevBtn.className = 'nmd-search-btn';
  prevBtn.onclick = () => findPrevious(view);

  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
  nextBtn.title = 'Next (Enter)';
  nextBtn.className = 'nmd-search-btn';
  nextBtn.onclick = () => findNext(view);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  closeBtn.title = 'Close (Esc)';
  closeBtn.className = 'nmd-search-btn nmd-search-close';
  closeBtn.onclick = () => { closeSearchPanel(view); view.focus(); };

  dom.appendChild(input);
  dom.appendChild(prevBtn);
  dom.appendChild(nextBtn);
  dom.appendChild(closeBtn);

  return { dom, top: false };
}
