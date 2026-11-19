import React from 'react';
import type { AssetKind } from './types';
import { KIND_LABEL } from './data';

type Size = 'grid' | 'list' | 'queue' | 'detail';

interface Props {
  kind: AssetKind | string;
  size?: Size;
  className?: string;
  title?: string;
}

/**
 * 按资源类型渲染不同默认缩略图（无真实预览图时使用）。
 * grid=媒资库卡片/时间轴 · list=列表行 · queue=审核队列 · detail=详情大图
 */
export function KindThumb({ kind, size = 'grid', className = '', title }: Props) {
  const k = (kind || 'document') as AssetKind;
  const label = KIND_LABEL[k] || '素材';
  const sizeClass = `kind-thumb kind-thumb-${size} kind-${k}${className ? ` ${className}` : ''}`;
  const accessible = title || `${label}默认缩略图`;

  return (
    <div
      className={sizeClass}
      data-kind={k}
      role="img"
      aria-label={accessible}
      title={accessible}
    >
      <svg
        className="kind-thumb-svg"
        viewBox="0 0 120 80"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        {renderArt(k)}
      </svg>
      <span className="kind-thumb-label">{label}</span>
    </div>
  );
}

function renderArt(kind: AssetKind) {
  switch (kind) {
    case 'image':
      return (
        <g>
          <rect x="18" y="14" width="84" height="52" rx="4" fill="#E8F1FC" stroke="#0066CC" strokeWidth="1.5" />
          <circle cx="40" cy="32" r="8" fill="#0066CC" opacity="0.85" />
          <path d="M24 58 L48 40 L62 50 L78 34 L96 58 Z" fill="#0066CC" opacity="0.35" />
          <path d="M18 58 L48 38 L62 48 L78 32 L102 58 L102 66 Q102 70 98 70 L22 70 Q18 70 18 66 Z" fill="#0066CC" opacity="0.15" />
        </g>
      );
    case 'video':
      return (
        <g>
          <rect x="14" y="16" width="92" height="50" rx="6" fill="#FFFFFF" stroke="#0066CC" strokeWidth="1.5" />
          <rect x="20" y="22" width="80" height="36" rx="3" fill="#E8F1FC" />
          <polygon points="52,32 52,50 70,41" fill="#0066CC" />
          <rect x="20" y="60" width="80" height="3" rx="1.5" fill="#D0D7DE" />
          <rect x="20" y="60" width="36" height="3" rx="1.5" fill="#0066CC" />
          <rect x="22" y="20" width="18" height="8" rx="2" fill="#0066CC" opacity="0.2" />
          <rect x="80" y="20" width="18" height="8" rx="2" fill="#0066CC" opacity="0.2" />
        </g>
      );
    case 'audio':
      return (
        <g>
          <rect x="14" y="18" width="92" height="46" rx="6" fill="#FFF5E6" stroke="#B36B00" strokeWidth="1.5" />
          {[28, 38, 48, 58, 68, 78, 88].map((x, i) => {
            const h = [14, 24, 34, 20, 30, 16, 22][i];
            return (
              <rect
                key={x}
                x={x}
                y={41 - h / 2}
                width="6"
                height={h}
                rx="3"
                fill="#FF9D00"
                opacity={0.4 + (i % 3) * 0.25}
              />
            );
          })}
          <circle cx="60" cy="41" r="3" fill="#B36B00" />
        </g>
      );
    case 'model3d':
      return (
        <g>
          <polygon points="60,14 96,34 60,54 24,34" fill="#E6F7EE" stroke="#007A2E" strokeWidth="1.5" />
          <polygon points="24,34 60,54 60,70 24,50" fill="#00B341" opacity="0.35" stroke="#007A2E" strokeWidth="1" />
          <polygon points="96,34 60,54 60,70 96,50" fill="#00B341" opacity="0.55" stroke="#007A2E" strokeWidth="1" />
          <circle cx="60" cy="34" r="3" fill="#007A2E" />
        </g>
      );
    case 'document':
      return (
        <g>
          <path d="M34 12 H74 L94 32 V68 H34 Z" fill="#F5F5F5" stroke="#5A5A5A" strokeWidth="1.5" />
          <path d="M74 12 V32 H94" fill="#E0E0E0" stroke="#5A5A5A" strokeWidth="1.5" />
          <rect x="42" y="40" width="36" height="3" rx="1.5" fill="#0066CC" opacity="0.7" />
          <rect x="42" y="48" width="44" height="3" rx="1.5" fill="#999" opacity="0.5" />
          <rect x="42" y="56" width="28" height="3" rx="1.5" fill="#999" opacity="0.5" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="30" y="20" width="60" height="44" rx="6" fill="#F0F0F0" stroke="#888" strokeWidth="1.5" />
          <circle cx="60" cy="42" r="12" fill="none" stroke="#888" strokeWidth="2" />
          <path d="M60 34 V42 L66 46" stroke="#888" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}
