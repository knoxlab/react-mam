import React, { useState } from 'react';
import { AppModal } from './AppModal';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  detail?: string;
  onClose: () => void;
}

/** 通用信息/结果提示弹窗（替代 alert）。 */
export function MessageModal({ open, title = '提示', message, detail, onClose }: Props) {
  return (
    <AppModal
      open={open}
      title={title}
      onClose={onClose}
      width={440}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          知道了
        </button>
      }
    >
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: detail ? 8 : 0 }}>{message}</p>
      {detail && (
        <div className="gate-note" style={{ marginTop: 8, wordBreak: 'break-all' }}>
          {detail}
        </div>
      )}
    </AppModal>
  );
}

export function useMessageModal() {
  const [state, setState] = useState<{
    open: boolean;
    title?: string;
    message: string;
    detail?: string;
  }>({ open: false, message: '' });

  const show = (message: string, opts?: { title?: string; detail?: string }) =>
    setState({ open: true, message, ...opts });
  const close = () => setState((s) => ({ ...s, open: false }));

  const node = (
    <MessageModal
      open={state.open}
      title={state.title}
      message={state.message}
      detail={state.detail}
      onClose={close}
    />
  );
  return { show, close, node };
}
