import { X } from "lucide-react";

type WordCountModalProps = {
  open: boolean;
  content: string;
  words: number;
  onClose: () => void;
};

export function WordCountModal({ open, content, words, onClose }: WordCountModalProps) {
  if (!open) return null;
  const lines = content ? content.split(/\r?\n/).length : 0;
  const paragraphs = content.trim() ? content.trim().split(/\n\s*\n/).length : 0;
  const characters = [...content].length;
  const charactersNoSpaces = [...content.replace(/\s/g, "")].length;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="word-count-modal" role="dialog" aria-modal="true" aria-label="字数统计" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>字数统计</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <dl>
          <div><dt>字/词</dt><dd>{words.toLocaleString()}</dd></div>
          <div><dt>字符（含空格）</dt><dd>{characters.toLocaleString()}</dd></div>
          <div><dt>字符（不含空格）</dt><dd>{charactersNoSpaces.toLocaleString()}</dd></div>
          <div><dt>段落</dt><dd>{paragraphs.toLocaleString()}</dd></div>
          <div><dt>行</dt><dd>{lines.toLocaleString()}</dd></div>
        </dl>
      </section>
    </div>
  );
}
