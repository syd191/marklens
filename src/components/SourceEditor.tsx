type SourceEditorProps = {
  value: string;
  fontSize: number;
  onChange: (value: string) => void;
};

export function SourceEditor({ value, fontSize, onChange }: SourceEditorProps) {
  return (
    <main className="source-shell">
      <textarea
        className="source-editor"
        spellCheck={false}
        value={value}
        style={{ fontSize: `${Math.max(13, fontSize - 1)}px` }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const next = `${value.slice(0, start)}  ${value.slice(end)}`;
          onChange(next);
          window.requestAnimationFrame(() => {
            target.selectionStart = start + 2;
            target.selectionEnd = start + 2;
          });
        }}
      />
    </main>
  );
}
