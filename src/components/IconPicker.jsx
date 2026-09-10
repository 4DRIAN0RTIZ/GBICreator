import { useEffect, useRef, useState } from 'react';
import { CATEGORY_ICONS } from '../constants/categoryIcons.js';

export function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = CATEGORY_ICONS.find((icon) => icon.value === value) || CATEGORY_ICONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="icon-picker" ref={wrapRef}>
      <button type="button" className="icon-picker-trigger" title={current.label} onClick={() => setOpen((o) => !o)}>
        <i className={`fa-solid fa-${current.value}`} />
      </button>
      {open ? (
        <div className="icon-picker-menu">
          {CATEGORY_ICONS.map((icon) => (
            <button
              type="button"
              key={icon.value}
              className={`icon-picker-option${icon.value === value ? ' active' : ''}`}
              title={icon.label}
              onClick={() => { onChange(icon.value); setOpen(false); }}
            >
              <i className={`fa-solid fa-${icon.value}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
