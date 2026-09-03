# HygNote

一个基于 Tauri 2、React 和 TypeScript 的本地桌面笔记本。笔记以时间流形式记录，支持悬浮窗快速输入、标签、搜索、Markdown 基础格式、图片粘贴和 Windows 安装包。

## 功能

### 主窗口

- 笔记按时间倒序展示，最新记录在上方
- 按日期分组，并在左侧时间轴中导航
- 默认加载最近 7 天的记录
- 滚动到底部自动加载更早的笔记，每页 40 条
- 笔记默认折叠为约 4 行，支持展开和收起
- 双击笔记或点击“编辑”修改内容和标签
- 支持置顶、取消置顶和删除
- 搜索笔记内容和标签
- `Ctrl+F` 快速聚焦搜索框
- 左侧时间轴和标签筛选可以隐藏

### 悬浮窗

- 全局快捷键 `Ctrl+Shift+N` 唤起
- 窗口始终置顶，不显示系统标题栏
- `Ctrl+Enter` 保存笔记
- `Esc` 关闭悬浮窗
- 支持加粗、有序列表、无序列表
- 支持选择图片和从剪贴板粘贴图片
- 图片插入后显示缩略图，点击缩略图查看大图

### 标签

- 一条笔记可以添加多个标签
- 标签名称由用户输入
- 输入标签后按回车确认，也可以使用逗号分隔
- 已使用过的标签会作为输入建议
- 主界面显示笔记标签，并支持点击标签筛选

### 主题

设置入口位于主窗口右上角，当前支持以下主题：

- 无人岛：Animal Island 风格，暖色羊皮纸、薄荷青和胶囊控件
- 深空
- 日光
- 午夜
- 森绿
- 暮粉
- 暖橙

主题会保存到本地，并同步到悬浮窗。

## Markdown 和图片

编辑器当前支持一组轻量 Markdown：

```markdown
**加粗文字**

- 无序列表
- 第二项

1. 有序列表
2. 第二项

![图片](images/example.jpg)
```

图片处理策略：

- 图片最长边限制为 1920 像素
- 保存前转换为 JPEG，质量约为 90%
- 使用压缩后内容的 SHA-256 作为文件名，重复图片只保存一份
- 图片与笔记分开保存，笔记中只保存相对路径
- 删除笔记或编辑图片引用后，会回收不再被引用的图片
- 应用启动时会再次清理未引用图片
- 列表中图片默认以缩略图显示，点击可查看大图

## 数据目录

应用数据与程序安装目录分离，目录结构如下：

```text
NoteData/
├── notes.db
├── images/
└── logs/
```

数据目录解析顺序：

1. 环境变量 `NOTE_DATA_DIR`
2. 程序目录下的 `data-dir.txt`
3. 程序目录下的 `data/` 目录（便携模式）
4. Windows 默认回退到 `%APPDATA%\com.note.app`

安装包会在安装时创建默认数据目录：

```text
%USERPROFILE%\Documents\NoteData
```

安装脚本会把数据目录记录到程序目录的 `data-dir.txt`。程序目录和数据目录不要混用，尤其不要把数据写入 `Program Files`。

## 开发环境

- Node.js 18+
- Rust 1.77+
- Windows WebView2
- Windows 构建需要 Rust MSVC 工具链和 Visual Studio C++ 构建工具

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run tauri dev
```

也可以在 Windows 下双击：

```text
启动开发.bat
```

## 构建 Windows 安装包

项目配置使用 NSIS，构建结果是 Windows setup.exe：

```bash
npm run setup
```

或者双击：

```text
打包安装.bat
```

安装包输出目录：

```text
src-tauri\target\release\bundle\nsis\
```

通常可以在该目录找到：

```text
Note_0.1.0_x64-setup.exe
```

当前安装模式为 `currentUser`，默认不需要管理员权限。安装器会检查并安装 WebView2 引导程序，目标机器没有 WebView2 时需要联网。

## 项目结构

```text
HygNote/
├── src/
│   ├── components/
│   │   ├── NoteEditor.tsx       # Markdown 编辑器、图片粘贴和缩略图
│   │   ├── NoteContent.tsx      # 笔记渲染、折叠和图片预览
│   │   ├── TagInput.tsx         # 多标签输入
│   │   ├── SettingsPanel.tsx    # 主题设置
│   │   └── TitleBar.tsx         # 无边框窗口标题栏
│   ├── windows/
│   │   ├── MainWindow.tsx       # 主窗口
│   │   └── FloatWindow.tsx      # 快速笔记悬浮窗
│   ├── lib/
│   │   ├── db.ts                # SQLite 查询、分页和图片回收
│   │   ├── markdown.ts          # 轻量 Markdown 解析
│   │   ├── images.ts            # 压缩、去重和图片路径处理
│   │   ├── search.ts            # 搜索匹配和高亮
│   │   ├── theme.ts             # 主题配置
│   │   └── tags.ts              # 标签处理
│   └── main.tsx                 # React 入口
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs               # Tauri 命令、窗口和快捷键
│   │   ├── data_dir.rs          # 数据目录解析
│   │   └── main.rs              # Rust 入口
│   ├── windows/hooks.nsh        # NSIS 安装和数据目录脚本
│   ├── capabilities/default.json
│   ├── tauri.conf.json
│   └── Cargo.toml
├── 启动开发.bat
├── 打包安装.bat
└── package.json
```

## 数据库

当前使用 SQLite，核心表结构如下：

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    pinned INTEGER DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_created_at
ON notes(created_at DESC);

CREATE INDEX idx_pinned
ON notes(pinned DESC, created_at DESC);
```

数据库迁移由 `tauri-plugin-sql` 管理。已经运行过的迁移不要修改原 SQL；新增表结构应增加新的 migration version，否则会出现 `migration was previously applied but has been modified`。

## 当前限制

- 当前 Markdown 是轻量解析器，不支持完整 CommonMark
- 暂不支持嵌套列表、表格、代码块和链接等复杂 Markdown
- 图片会统一转为 JPEG，透明 PNG 的透明区域可能被转换为黑色或默认背景
- 图片目前存储在本地，不支持云同步
- 搜索结果最多返回 200 条
- 主窗口分页按时间游标加载，时间轴跳转到很早日期时会逐页加载
- 安装器可以选择程序安装目录，数据目录当前由安装脚本和 `data-dir.txt` 管理

## 后续计划

- [ ] 设置中自定义数据目录并迁移现有数据
- [ ] 导出 Markdown / JSON
- [ ] 完整 Markdown 渲染
- [ ] 图片保留 PNG/WebP 格式选项
- [ ] 图片拖拽插入、裁剪和压缩参数
- [ ] 数据备份和恢复
- [ ] 更完整的日志系统

## 许可证

本项目使用 MIT License，详见 [LICENSE](./LICENSE)。

项目使用的 `animal-island-ui` 依赖为 CC BY-NC 4.0，使用该主题或组件时请遵守其非商业使用和署名要求。
