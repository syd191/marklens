import { X } from "lucide-react";
import type { AppStrings } from "../lib/i18n";

type WordCountModalProps = {
  t: AppStrings;
  open: boolean;
  content: string;
  words: number;
  onClose: () => void;
};

export function WordCountModal({ t, open, content, words, onClose }: WordCountModalProps) {
  if (!open) return null;
  const lines = content ? content.split(/\r?\n/).length : 0;
  const paragraphs = content.trim() ? content.trim().split(/\n\s*\n/).length : 0;
  const characters = [...content].length;
  const charactersNoSpaces = [...content.replace(/\s/g, "")].length;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="word-count-modal" role="dialog" aria-modal="true" aria-label={t.wordCount.aria} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{t.wordCount.title}</h2>
          <button type="button" aria-label={t.common.close} onClick={onClose}><X size={16} /></button>
        </header>
        <dl>
          <div><dt>{t.wordCount.words}</dt><dd>{words.toLocaleString()}</dd></div>
          <div><dt>{t.wordCount.charactersWithSpaces}</dt><dd>{characters.toLocaleString()}</dd></div>
          <div><dt>{t.wordCount.charactersNoSpaces}</dt><dd>{charactersNoSpaces.toLocaleString()}</dd></div>
          <div><dt>{t.wordCount.paragraphs}</dt><dd>{paragraphs.toLocaleString()}</dd></div>
          <div><dt>{t.wordCount.lines}</dt><dd>{lines.toLocaleString()}</dd></div>
        </dl>
      </section>
    </div>
  );
}
