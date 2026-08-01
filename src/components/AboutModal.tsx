import { ExternalLink, Github, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { AppStrings } from "../lib/i18n";
import appIcon from "../../assets/icon.png";

export const PROJECT_REPOSITORY_URL = "https://github.com/syd191/marklens";

type AboutModalProps = {
  t: AppStrings;
  open: boolean;
  onClose: () => void;
  onOpenProject: () => void;
};

export function AboutModal({ t, open, onClose, onOpenProject }: AboutModalProps) {
  const [qrSource, setQrSource] = useState("");

  useEffect(() => {
    if (!open) {
      setQrSource("");
      return;
    }

    let active = true;
    void QRCode.toDataURL(PROJECT_REPOSITORY_URL, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 360,
      color: { dark: "#24292f", light: "#ffffff" }
    }).then((value) => {
      if (active) setQrSource(value);
    });

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="about-modal" role="dialog" aria-modal="true" aria-label={t.about.aria} onMouseDown={(event) => event.stopPropagation()}>
        <header className="about-titlebar">
          <div>
            <span className="about-eyebrow">{t.about.eyebrow}</span>
            <h2>{t.about.title}</h2>
          </div>
          <button type="button" aria-label={t.common.close} onClick={onClose}><X size={17} /></button>
        </header>

        <div className="about-content">
          <div className="about-project-copy">
            <div className="about-app-badge" aria-hidden="true"><img src={appIcon} alt="" /></div>
            <p className="about-description">{t.about.description}</p>
            <p className="about-repository-label">{t.about.repository}</p>
            <button className="about-project-link" type="button" onClick={onOpenProject}>
              <span>{PROJECT_REPOSITORY_URL}</span>
              <ExternalLink size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="about-qr-card">
            <div className="about-qr-frame">
              {qrSource ? <img src={qrSource} alt={t.about.qrAlt} /> : <QrCode className="about-qr-loading" aria-hidden="true" />}
              <span className="about-qr-mark" aria-hidden="true"><Github size={20} fill="currentColor" /></span>
            </div>
            <p>{t.about.scan}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
