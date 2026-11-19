import React, { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** 站点内统一模态框（与登录弹窗同风格，非浏览器原生对话框）。 */
export function AppModal({ open, title, onClose, width = 560, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="login-modal-mask"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="login-modal app-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
      >
        <div className="login-modal-header">
          <h2>{title}</h2>
          <button type="button" className="login-modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="app-modal-body">{children}</div>
        {footer && <div className="app-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
