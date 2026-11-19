import React, { useEffect, useRef, useState } from 'react';
import {
  avatarText,
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  type CurrentUser
} from './api';

interface Props {
  /** 登录成功后触发目录/活动等刷新。 */
  onAuthChanged?: () => void;
  /** 侧栏收起时仅显示头像/登录图标。 */
  collapsed?: boolean;
  /** 收起态点击用户区时展开侧栏（不直接登录）。 */
  onExpand?: () => void;
}

/**
 * 左侧栏底部固定用户区：
 * - 未登录：显示「登录」按钮 → 打开登录弹窗
 * - 已登录：头像 + 显示名，点击可退出
 * - 收起侧栏：仅头像/登录图标，点击先展开侧栏
 */
export function SidebarUser({ onAuthChanged, collapsed, onExpand }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((u) => {
      if (!cancelled) {
        setUser(u.authenticated ? u : null);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setBusy(true);
    setError('');
    const result = await apiLogin(username.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || '登录失败');
      return;
    }
    setUser(result.user?.authenticated ? result.user : { authenticated: true, username: username.trim() });
    setShowLogin(false);
    setPassword('');
    onAuthChanged?.();
  }

  async function doLogout() {
    await apiLogout();
    setUser(null);
    setMenuOpen(false);
    onAuthChanged?.();
  }

  const name = user ? user.displayName || user.username || '用户' : '';
  const role = user?.roles?.includes('system-admin')
    ? '系统管理员'
    : user?.roles?.length
      ? user.roles[0]
      : '';

  return (
    <>
      <div className={`sidebar-user${collapsed ? ' is-collapsed' : ''}`}>
        {ready && user && user.authenticated ? (
          <div className="user-block" ref={menuRef}>
            <button
              type="button"
              className={`user-trigger${collapsed ? ' compact' : ''}`}
              onClick={() => {
                if (collapsed) {
                  onExpand?.();
                  return;
                }
                setMenuOpen((v) => !v);
              }}
              aria-expanded={collapsed ? undefined : menuOpen}
              aria-label={collapsed ? '展开侧栏查看用户' : '用户菜单'}
              title={collapsed ? name : undefined}
            >
              <span className="user-avatar" aria-hidden="true">
                {avatarText(user)}
              </span>
              {!collapsed && (
                <>
                  <span className="user-meta">
                    <span className="user-name">{name}</span>
                    {role && <span className="user-role">{role}</span>}
                  </span>
                  <span className="user-caret" aria-hidden="true">
                    ▾
                  </span>
                </>
              )}
            </button>
            {menuOpen && !collapsed && (
              <div className="user-menu" role="menu">
                <div className="user-menu-info">
                  <div className="user-menu-name">{name}</div>
                  <div className="user-menu-sub">
                    {user.username}
                    {user.userId ? ` · ${user.userId.slice(0, 8)}…` : ''}
                  </div>
                </div>
                <button type="button" className="user-menu-item" onClick={doLogout}>
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={`user-login-btn${collapsed ? ' compact' : ''}`}
            title="登录"
            aria-label="登录"
            onClick={() => {
              if (collapsed) onExpand?.();
              setShowLogin(true);
            }}
            disabled={!ready}
          >
            <span className="login-icon" aria-hidden="true">
              {ready ? ' →' : '…'}
            </span>
            {!collapsed && <span className="login-label">{ready ? '登录' : '…'}</span>}
          </button>
        )}
      </div>

      {showLogin && (
        <div
          className="login-modal-mask"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogin(false);
          }}
        >
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mam-login-title"
          >
            <div className="login-modal-header">
              <h2 id="mam-login-title">登录</h2>
              <button
                type="button"
                className="login-modal-close"
                onClick={() => setShowLogin(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <form className="login-form" onSubmit={submitLogin}>
              <label className="login-field">
                <span>用户名</span>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="admin"
                />
              </label>
              <label className="login-field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                />
              </label>
              {error && <div className="login-error">{error}</div>}
              <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                {busy ? '登录中…' : '登录'}
              </button>
              <p className="login-hint">
                使用 PowerCMS 管理端账号登录；登录后可查看审计活动与版本等授权数据。
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
