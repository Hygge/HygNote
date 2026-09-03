# Note - 桌面笔记本应用

一个基于 Tauri 2 + React + TypeScript 的桌面笔记应用，支持时间流式记录和快速悬浮窗。

## 功能特性

### 主窗口
- **时间流布局**：笔记按时间倒序排列（最新在上）
- **时间轴导航**：左侧时间轴快速跳转到指定日期
- **快速输入**：类似聊天的输入框，按 Enter 发送
- **笔记管理**：
  - 📌 置顶重要笔记
  - 🗑 删除笔记
  - 按日期自动分组（今天、昨天、具体日期）

### 悬浮窗
- **全局快捷键**：按 `Ctrl+Shift+N` 随时唤起
- **置顶显示**：始终在最前，不遮挡其他窗口
- **快速记录**：
  - 输入内容后按 `Ctrl+Enter` 保存
  - 按 `Esc` 关闭窗口

### 数据存储
- **SQLite 数据库**：本地持久化存储
- **自动迁移**：首次启动自动创建数据库表
- **索引优化**：按时间和置顶状态建立索引

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **后端**：Rust + Tauri 2
- **数据库**：SQLite (tauri-plugin-sql)
- **快捷键**：tauri-plugin-global-shortcut

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run tauri dev
```

## 构建应用

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

## 使用说明

### 主窗口操作
1. 在底部输入框输入笔记内容
2. 按 `Enter` 发送（按 `Shift+Enter` 换行）
3. 点击时间轴跳转到指定日期的笔记
4. 悬停笔记卡片显示操作按钮（置顶/删除）

### 悬浮窗操作
1. 按 `Ctrl+Shift+N` 唤起悬浮窗
2. 输入笔记内容
3. 按 `Ctrl+Enter` 保存并关闭
4. 按 `Esc` 取消并关闭

## 项目结构

```
note/
├── src/                    # React 前端代码
│   ├── windows/           # 窗口组件
│   │   ├── MainWindow.tsx # 主窗口
│   │   └── FloatWindow.tsx# 悬浮窗
│   ├── lib/               # 工具库
│   │   ├── db.ts          # 数据库操作
│   │   ├── types.ts       # TypeScript 类型
│   │   └── date.ts        # 日期格式化
│   ├── App.tsx            # 根组件
│   └── main.tsx           # 入口文件
├── src-tauri/             # Rust 后端代码
│   ├── src/
│   │   ├── lib.rs         # 主逻辑（窗口管理、数据库迁移、快捷键）
│   │   └── main.rs        # 入口
│   ├── tauri.conf.json    # Tauri 配置
│   └── Cargo.toml         # Rust 依赖
└── package.json           # Node.js 依赖
```

## 数据库表结构

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    pinned INTEGER DEFAULT 0
);

CREATE INDEX idx_created_at ON notes(created_at DESC);
CREATE INDEX idx_pinned ON notes(pinned DESC, created_at DESC);
```

## UI 设计

- **配色方案**：深色主题（背景 #05070C，强调色 #38BDF8）
- **布局**：左侧时间轴 (200px) + 右侧内容区
- **字体**：系统默认字体栈（Microsoft YaHei、Segoe UI 等）
- **动画**：悬停效果和过渡动画

## 开发注意事项

### 透明加密环境
如果在装有 DSOC/DGClient 透明加密客户端的机器上开发：
- 使用 Read/Edit/Write 工具操作源码文件
- 不要使用 shell 命令（cat/grep）读取 .ts/.tsx/.rs 文件
- npm/cargo 等工具不受影响

### 热更新
- 前端代码修改后自动热更新
- Rust 代码修改后需要重新编译（自动触发）

## 后续扩展

- [ ] 标签系统
- [ ] 全文搜索
- [ ] Markdown 支持
- [ ] 导出功能（Markdown/JSON）
- [ ] 数据同步
- [ ] 主题切换

## 许可证

MIT
