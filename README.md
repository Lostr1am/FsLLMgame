# 巅峰回廊 · APEX CORRIDOR（网页版）

《无畏契约》职业选手人生模拟器 —— **纯前端原型**，无后端、无构建步骤、无依赖安装。

## 在线游玩

部署后直接访问站点根地址即可（本项目入口就是根目录的 `index.html`）。

## 本地运行

- 双击 `启动本地服务器.cmd`（需要 Python，会自动打开 http://localhost:8080）
- 或直接双击 `index.html`（建议 Chrome / Edge；此方式下存档可能不稳定）

详细说明见 `如何开始.txt`。

## 部署（Vercel / Cloudflare Pages / GitHub Pages 均可）

本项目是**纯静态站点**，没有 package.json，不需要构建：

| 平台 | 配置 |
|---|---|
| Vercel | Framework Preset 选 **Other**，Build Command 留空，Output Directory 填 `.`（仓库根即站点根） |
| Cloudflare Pages | Framework preset **None**，Build command 留空，Build output directory 填 `/` |
| GitHub Pages | Settings → Pages → Source 选分支根目录（`/`） |
| Render | New → Static Site，Build Command 留空，Publish Directory 填 `.` |

仓库根目录需要包含：`index.html`、`assets/`（`vercel.json` 可选，用于静态资源缓存头）。

## 目录

```
index.html          单页外壳（三个屏幕 + 19 个模态框 + 图标库）
assets/css/         设计令牌 / 组件 / 屏幕与酒馆模式样式
assets/js/          数据层 · 状态层 · 建档 · 面板 · 酒馆层 · API 层 · 叙事 · 直播 · 存档
vercel.json         可选：缓存头与 cleanUrls
```

## 说明

- 存档保存在浏览器 `localStorage`，换设备/清缓存即丢失；游戏内可导出存档 JSON。
- 默认使用本地推演引擎，**不发起任何网络请求**；如需接真实模型，在酒馆模式 →「API 接入」里配置 OpenAI 兼容端点。
