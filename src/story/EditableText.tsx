import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  editing: boolean;
  onChange(v: string): void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  label: string;
}

/**
 * Helyben szerkeszthető szöveg. Nézet módban sima szöveg; szerkesztő
 * módban ugyanazzal a tipográfiával input/textarea, így a user pontosan
 * azt látja, ami a végeredményben lesz.
 */
export function EditableText({ value, editing, onChange, placeholder, multiline, className = '', label }: Props) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  if (!editing) return value ? <span className={className}>{value}</span> : null;

  const commit = () => draft !== value && onChange(draft.trim() || value);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={draft}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => setDraft(multiline ? e.target.value : e.target.value.replace(/\n/g, ' '))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={`block w-full resize-none overflow-hidden rounded-md bg-transparent outline-dashed outline-1 outline-offset-4 outline-line transition hover:outline-muted focus:outline-2 focus:outline-solid focus:outline-accent ${className}`}
      style={{ font: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', color: 'inherit' }}
    />
  );
}
