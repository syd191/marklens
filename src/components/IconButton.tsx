import type { ReactNode } from "react";

type IconButtonProps = {
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
};

export function IconButton({ title, active, disabled, children, onClick }: IconButtonProps) {
  return (
    <button
      className={`icon-button${active ? " is-active" : ""}`}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
