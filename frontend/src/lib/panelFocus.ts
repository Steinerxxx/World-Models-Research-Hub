import { useState, useEffect } from 'react';

type Panel = 'comments' | 'summary';
let _focus: Panel | null = null;
let _subs: Array<() => void> = [];

export function focusPanel(p: Panel) {
  if (_focus === p) return;
  _focus = p;
  _subs.forEach(fn => fn());
}

export function usePanelFocus() {
  const [, update] = useState(0);
  useEffect(() => {
    const fn = () => update(n => n + 1);
    _subs.push(fn);
    return () => { _subs = _subs.filter(s => s !== fn); };
  }, []);
  return (panel: Panel) => _focus === panel;
}
