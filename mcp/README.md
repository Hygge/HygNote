# HygNote MCP 使用说明

给外部 AI 查询 HygNote **公开笔记** 的 stdio MCP 服务。

上锁私密笔记（`locked = 1`）由服务端强制过滤，客户端无法读取。

## 前置条件

- 本机已安装 Node.js 18+
- 已安装 HygNote，或使用便携版解压目录

## 接入

### 安装版

当前用户安装后，MCP 入口在：

```text
%LOCALAPPDATA%\HygNote\mcp\hygnote-mcp.cmd
```

外部 AI 配置：

```json
{
  "mcpServers": {
    "hygnote": {
      "command": "%LOCALAPPDATA%\\HygNote\\mcp\\hygnote-mcp.cmd"
    }
  }
}
```

如果外部 AI 不展开环境变量，改成实际路径：

```json
{
  "mcpServers": {
    "hygnote": {
      "command": "C:\\Users\\你的用户名\\AppData\\Local\\HygNote\\mcp\\hygnote-mcp.cmd"
    }
  }
}
```

### 便携版

把解压目录里的入口配进去：

```json
{
  "mcpServers": {
    "hygnote": {
      "command": "D:\\解压目录\\mcp\\hygnote-mcp.cmd"
    }
  }
}
```

### 开发环境

```json
{
  "mcpServers": {
    "hygnote": {
      "command": "D:\\dev\\code\\ai\\note\\mcp\\hygnote-mcp.cmd"
    }
  }
}
```

## 可用工具

### `list_recent_public_notes`

列出最近公开笔记。

参数：

- `days`：最近几天，默认 `7`，范围 `1-365`
- `limit`：最多返回条数，默认 `20`，最大 `100`

### `search_public_notes`

按关键词和/或标签搜索公开笔记。

参数：

- `query`：匹配内容和标签
- `tag`：精确匹配标签名
- `limit`：最多返回条数，默认 `20`，最大 `100`

## 返回内容

成功时返回 JSON，例如：

```json
{
  "ok": true,
  "count": 2,
  "notes": [
    {
      "id": "...",
      "content": "...",
      "created_at": 1710000000000,
      "created_at_iso": "2024-03-09T12:00:00.000Z",
      "pinned": 0,
      "tags": ["工作"]
    }
  ]
}
```

结果中没有 `locked` 字段。上锁笔记不会出现。

## 权限限制

- 只读，不能新增、修改、删除笔记
- 不能直接打开或导出整个 `notes.db`
- `locked = 1` 的私密笔记永远不会返回
- 没有公开结果时，应说明“没有公开笔记”，不要猜测私密内容

## 数据位置

MCP 按以下顺序查找 `notes.db`：

1. 环境变量 `NOTE_DATA_DIR`
2. 程序目录下的 `data-dir.txt`
3. 程序目录下的 `data/notes.db`
4. `%USERPROFILE%\Documents\NoteData\notes.db`
5. `%APPDATA%\com.note.app\notes.db`

安装版默认使用：

```text
%USERPROFILE%\Documents\NoteData\notes.db
```
