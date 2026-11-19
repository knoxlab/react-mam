import React, { useState } from 'react';
import { AppModal } from './AppModal';

interface Props {
  open: boolean;
  assetTitle: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}

/** 驳回：应用内弹窗填写意见（非浏览器 prompt）。 */
export function RejectModal({ open, assetTitle, onClose, onConfirm }: Props) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!comment.trim()) {
      setError('请填写驳回意见');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onConfirm(comment.trim());
      setComment('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '驳回失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      open={open}
      title="驳回素材"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void submit()} disabled={busy}>
            {busy ? '提交中…' : '确认驳回'}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        素材：<strong>{assetTitle}</strong>
        <br />
        驳回后状态将变为<strong>草稿 / 编目中</strong>，意见会写入版本备注并留痕。
      </p>
      <label className="login-field">
        <span>
          驳回意见 <span style={{ color: 'var(--color-status-reject)' }}>*</span>
        </span>
        <textarea
          className="form-textarea"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="请说明驳回原因（必填）"
          autoFocus
        />
      </label>
      {error && <div className="login-error">{error}</div>}
    </AppModal>
  );
}
