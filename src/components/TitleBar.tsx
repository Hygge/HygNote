import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "animal-island-ui";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

type TitleBarProps = {
  title: string;
  variant?: "main" | "float";
  extra?: ReactNode;
  onSettings?: () => void;
  settingsOpen?: boolean;
};

export function TitleBar({
  title,
  variant = "main",
  extra,
  onSettings,
  settingsOpen = false,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    win.isMaximized().then(setMaximized).catch(() => undefined);
    win
      .onResized(() => {
        win.isMaximized().then(setMaximized).catch(() => undefined);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, [win]);

  const onDragMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.detail === 2) {
      if (variant === "main") {
        win.toggleMaximize();
      }
      return;
    }
    win.startDragging();
  };

  return (
    <div className={`titlebar titlebar-${variant}`}>
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        onMouseDown={onDragMouseDown}
      >
        <span className="titlebar-mark" data-tauri-drag-region />
        <span className="titlebar-title" data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className="titlebar-extra">
        {extra}
        {onSettings ? (
          <button
            type="button"
            className={`titlebar-settings ${settingsOpen ? "active" : ""}`}
            title="设置"
            onClick={onSettings}
          >
            <Icon name="icon-design" size={16} />
          </button>
        ) : null}
      </div>
      <div className="titlebar-controls">
        {variant === "main" && (
          <>
            <button
              type="button"
              title="最小化"
              onClick={() => win.minimize()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            <button
              type="button"
              title={maximized ? "还原" : "最大化"}
              onClick={() => win.toggleMaximize()}
            >
              {maximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M3 2.5h4.5V7M2.5 3.5H7v4.5H2.5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect
                    x="1.5"
                    y="1.5"
                    width="7"
                    height="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
            </button>
          </>
        )}
        <button
          type="button"
          className="titlebar-close"
          title="关闭"
          onClick={() => win.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 2l6 6M8 2L2 8"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
