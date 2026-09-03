import { Button, Drawer } from "animal-island-ui";
import { THEMES, type ThemeId } from "../lib/theme";
import "./SettingsPanel.css";

type SettingsPanelProps = {
  open: boolean;
  themeId: ThemeId;
  onClose: () => void;
  onThemeChange: (id: ThemeId) => void;
};

export function SettingsPanel({
  open,
  themeId,
  onClose,
  onThemeChange,
}: SettingsPanelProps) {
  return (
    <Drawer
      open={open}
      title="设置"
      width={380}
      onClose={onClose}
      pushBackground={false}
    >
      <section className="settings-section">
        <h3>主题颜色</h3>
        <p className="settings-hint">立即生效，并同步到悬浮窗</p>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-card ${themeId === theme.id ? "active" : ""}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <span
                className="theme-preview"
                style={{
                  background: theme.tokens.bg,
                  borderColor: theme.tokens.border,
                }}
              >
                <span
                  className="theme-preview-bar"
                  style={{ background: theme.tokens.bgSidebar }}
                />
                <span
                  className="theme-preview-dot"
                  style={{ background: theme.tokens.accent }}
                />
              </span>
              <span className="theme-meta">
                <strong>{theme.name}</strong>
                <em>{theme.desc}</em>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="settings-footer">
        <Button type="primary" onClick={onClose}>
          完成
        </Button>
      </div>
    </Drawer>
  );
}
