# 指标追踪助手

一个用于长期记录与分析化验指标的轻量应用，支持手动录入与 AI 图片识别，自动生成趋势图和历史记录，并可自定义指标与正常范围。

**功能概览**
- 手动录入化验数据，支持备注
- 上传化验单图片，AI 自动提取指标并批量入库
- 指标趋势图（可选时间范围 + 自定义日期）
- 历史记录表格（编辑 / 删除）
- 指标配置（启用开关、列表/图表可见、正常范围、颜色、简称）
- SQLite 本地持久化

**技术栈**
- React 19 + Vite 6
- Tailwind CSS v4
- Express
- SQLite（`node:sqlite`）
- Recharts
- Google GenAI SDK（Gemini）

**本地运行**
1. 安装依赖
```bash
npm install
```

2. 配置环境变量（用于 AI 识别）
在项目根目录创建 `.env.local`：
```bash
GEMINI_API_KEY=你的_Gemini_API_Key
```

3. 启动开发服务
```bash
npm run dev
```

4. 访问应用
```text
http://localhost:3000
```
默认端口为 `3000`，可通过设置 `PORT` 覆盖。

**生产构建**
```bash
npm run build
NODE_ENV=production npm run start
```

**数据存储**
- 数据库文件：`/Users/liangqinao/work/Indicator-tracking/data.db`
- 表结构：`records`（检测记录：日期、指标值、备注）
- 表结构：`indicators`（指标配置：单位、范围、颜色、显示开关）

**主要模块**
- 后端服务：`/Users/liangqinao/work/Indicator-tracking/server.ts`
- 前端入口：`/Users/liangqinao/work/Indicator-tracking/src/main.tsx`
- 全局数据与 API：`/Users/liangqinao/work/Indicator-tracking/src/store/useAppStore.ts`
- 页面：`/Users/liangqinao/work/Indicator-tracking/src/components/Dashboard.tsx` 最新指标概览
- 页面：`/Users/liangqinao/work/Indicator-tracking/src/components/Charts.tsx` 趋势图
- 页面：`/Users/liangqinao/work/Indicator-tracking/src/components/AddRecord.tsx` 录入（手动 / AI）
- 页面：`/Users/liangqinao/work/Indicator-tracking/src/components/RecordHistory.tsx` 历史记录
- 页面：`/Users/liangqinao/work/Indicator-tracking/src/components/Settings.tsx` 指标设置

**AI 识别说明**
- 图片识别使用 Gemini 模型 `gemini-3-flash-preview`（前端直连）。
- 趋势分析的 AI 面板在 `Dashboard.tsx` 中已注释，如需启用可取消注释并保证 `GEMINI_API_KEY` 可用。
- 生产环境中不建议将 Key 暴露在前端，建议迁移到服务端代理调用。

**API 路由（开发服务内置）**
- `GET /api/records`
- `POST /api/records`
- `PUT /api/records/:id`
- `DELETE /api/records/:id`
- `GET /api/indicators`
- `POST /api/indicators`
- `PUT /api/indicators/:id`
- `DELETE /api/indicators/:id`
- `POST /api/indicators/reset`
