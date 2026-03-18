import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { ProxyAgent } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setupAiProxy = () => {
  const proxyUrl = process.env.AI_PROXY_URL;
  if (!proxyUrl) return;
  if (typeof globalThis.fetch !== 'function') return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const proxyAgent = new ProxyAgent(proxyUrl);
  const proxyHosts = ['generativelanguage.googleapis.com', 'ai.google.dev'];
  globalThis.fetch = ((input: any, init?: any) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input?.url;
    if (url && proxyHosts.some(host => url.includes(host))) {
      return originalFetch(input, { ...(init || {}), dispatcher: proxyAgent });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  console.log(`[ai-proxy] Enabled for ${proxyHosts.join(', ')}`);
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  setupAiProxy();

  app.use(express.json());

  const uploadsDir = path.join(__dirname, 'uploads');
  const reportUploadDir = path.join(uploadsDir, 'reports');
  const aiUploadDir = path.join(uploadsDir, 'ai-jobs');
  fs.mkdirSync(reportUploadDir, { recursive: true });
  fs.mkdirSync(aiUploadDir, { recursive: true });

  const reportStorage = multer.diskStorage({
    destination: reportUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `${randomUUID()}${ext}`);
    }
  });
  const uploadReport = multer({ storage: reportStorage });

  const aiStorage = multer.diskStorage({
    destination: aiUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `${randomUUID()}${ext}`);
    }
  });
  const uploadAi = multer({ storage: aiStorage });

  // Initialize Database
  const db = new DatabaseSync(path.join(__dirname, 'data.db'));

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      values_json TEXT NOT NULL,
      notes TEXT
    );
    
    CREATE TABLE IF NOT EXISTS indicators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      minNormal REAL,
      maxNormal REAL,
      color TEXT,
      isActive INTEGER DEFAULT 1,
      visibleInChart INTEGER DEFAULT 1,
      visibleInList INTEGER DEFAULT 1,
      shortName TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS report_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_files (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      date TEXT,
      title TEXT,
      file_path TEXT NOT NULL,
      original_name TEXT,
      mime TEXT,
      size INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      file_path TEXT NOT NULL,
      original_name TEXT,
      mime TEXT,
      date TEXT,
      result_json TEXT,
      conflict_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const getSetting = (key: string, defaultValue?: string) => {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value?: string } | undefined;
    if (!row && defaultValue !== undefined) {
      db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
        key,
        defaultValue,
        new Date().toISOString()
      );
      return defaultValue;
    }
    return row?.value ?? defaultValue;
  };

  const setSetting = (key: string, value: string) => {
    db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(
      key,
      value,
      new Date().toISOString()
    );
  };

  try {
    db.exec('ALTER TABLE indicators ADD COLUMN visibleInList INTEGER DEFAULT 1');
  } catch (e) { /* ignore if exists */ }
  try {
    db.exec('ALTER TABLE indicators ADD COLUMN shortName TEXT');
  } catch (e) { /* ignore if exists */ }
  try {
    db.exec('ALTER TABLE indicators ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch (e) { /* ignore if exists */ }

  try {
    db.exec('UPDATE indicators SET sort_order = rowid WHERE sort_order IS NULL OR sort_order = 0');
  } catch (e) { /* ignore */ }

  // Check if indicators table is empty, if so, seed it
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM indicators');
  const count = countStmt.get() as { count: number };
  if (count.count === 0) {
    const defaultIndicators = [
      { id: "wbc", name: "白细胞计数 (WBC)", unit: "10^9/L", minNormal: 3.5, maxNormal: 9.5, color: "#3b82f6", visibleInList: true, shortName: "白" },
      { id: "hgb", name: "血红蛋白 (HGB)", unit: "g/L", minNormal: 130, maxNormal: 175, color: "#f97316", shortName: "红" },
      { id: "neut", name: "中性粒细胞绝对值 (NEUT#)", unit: "10^9/L", minNormal: 2.8, maxNormal: 6.3, color: "#8b5cf6", shortName: "粒" },
      { id: "plt", name: "血小板计数 (PLT)", unit: "10^9/L", minNormal: 125, maxNormal: 350, color: "#eab308", shortName: "板" },
      { id: "lymph", name: "淋巴细胞绝对值 (LYMPH#)", unit: "10^9/L", minNormal: 1.1, maxNormal: 3.2, color: "#10b981" },
      { id: "mono", name: "单核细胞绝对值 (MONO#)", unit: "10^9/L", minNormal: 0.1, maxNormal: 0.6, color: "#06b6d4" },
      { id: "eo", name: "嗜酸性粒细胞绝对值 (EO#)", unit: "10^9/L", minNormal: 0.02, maxNormal: 0.52, color: "#f43f5e" },
      { id: "baso", name: "嗜碱性粒细胞绝对值 (BASO#)", unit: "10^9/L", minNormal: 0, maxNormal: 0.06, color: "#6366f1" },
      { id: "neut_pct", name: "中性粒细胞百分比 (NEUT%)", unit: "%", minNormal: 40, maxNormal: 75, color: "#a78bfa" },
      { id: "lymph_pct", name: "淋巴细胞百分比 (LYMPH%)", unit: "%", minNormal: 20, maxNormal: 50, color: "#34d399", isActive: true },
      { id: "mono_pct", name: "单核细胞百分比 (MONO%)", unit: "%", minNormal: 3, maxNormal: 10, color: "#67e8f9" },
      { id: "eo_pct", name: "嗜酸性粒细胞百分比 (EO%)", unit: "%", minNormal: 0.4, maxNormal: 8, color: "#fb7185" },
      { id: "baso_pct", name: "嗜碱性粒细胞百分比 (BASO%)", unit: "%", minNormal: 0, maxNormal: 1, color: "#818cf8" },
      { id: "rbc", name: "红细胞计数 (RBC)", unit: "10^12/L", minNormal: 4.3, maxNormal: 5.8, color: "#ef4444" },
      { id: "hct", name: "红细胞压积 (HCT)", unit: "%", minNormal: 40, maxNormal: 50, color: "#fdba74" },
      { id: "mcv", name: "平均红细胞体积 (MCV)", unit: "fL", minNormal: 82, maxNormal: 100, color: "#fca5a5" },
      { id: "mch", name: "平均红细胞血红蛋白量 (MCH)", unit: "pg", minNormal: 27, maxNormal: 34, color: "#f87171", isActive: false },
      { id: "mchc", name: "平均红细胞血红蛋白浓度 (MCHC)", unit: "g/L", minNormal: 316, maxNormal: 354, color: "#dc2626", isActive: false },
      { id: "rdw_cv", name: "红细胞分布宽度 (RDW-CV)", unit: "%", minNormal: 11.5, maxNormal: 14.5, color: "#b91c1c", isActive: false },
      { id: "mpv", name: "平均血小板体积 (MPV)", unit: "fL", minNormal: 6.5, maxNormal: 12, color: "#fef08a", isActive: false },
      { id: "pct", name: "血小板压积 (PCT)", unit: "%", minNormal: 0.1, maxNormal: 0.28, color: "#fde047", isActive: false },
      { id: "pdw", name: "血小板分布宽度 (PDW)", unit: "%", minNormal: 9, maxNormal: 17, color: "#ca8a04", isActive: false },
      { id: "blasts", name: "骨髓原始细胞 (Blasts)", unit: "%", minNormal: 0, maxNormal: 5, color: "#ec4899", isActive: false },
      { id: "custom_1773756216361_97s4x", name: "低密度脂蛋白胆固醇 (LDL-C)", unit: "mmol/L", color: "#14b8a6", isActive: false },
      { id: "custom_1773756439052_bfinc", name: "γ-谷氨酰基转移酶 (GGT)", unit: "U/L ", color: "#ec4899", minNormal: 7, maxNormal: 45, isActive: true },
      { id: "custom_1773756495876_pg45w", name: "高密度脂蛋白胆固醇 (HDL-C)", unit: "mmol/L", minNormal: 1.04, color: "#10b981", isActive: false },
      { id: "custom_1773756678535_smor0", name: "☆甘油三酯 ( TG )", unit: "mmol/L", color: "#3b82f6", isActive: false },
      { id: "custom_1773756998879_ie2xe", name: "☆总胆固醇", unit: "mmol/L", maxNormal: 5.18, color: "#f59e0b", isActive: false },
      { id: "custom_1773757087913_9frul", name: "红细胞分布宽度SD", unit: "fL", minNormal: 37, maxNormal: 54, color: "#14b8a6", isActive: false },
      { id: "custom_1773757260272_kjlio", name: "铁蛋白", unit: "ng/mL", minNormal: 11, maxNormal: 306.8, color: "#14b8a6", isActive: false },
      { id: "custom_1773757260272_9wqp2", name: "尿酸", unit: "μmol/L", minNormal: 155, maxNormal: 357, color: "#3b82f6", isActive: false },
      { id: "custom_1773759019102_0568o", name: "大血小板比值", unit: "", minNormal: 0.13, maxNormal: 0.43, color: "#06b6d4", isActive: false },
      { id: "custom_1773759046914_g8yb3", name: "大血小板比值", unit: "", minNormal: 0.13, maxNormal: 0.43, color: "#f43f5e", isActive: false }
    ];
    
    const stmt = db.prepare('INSERT INTO indicators (id, name, unit, minNormal, maxNormal, color, isActive, visibleInChart, visibleInList, shortName, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    defaultIndicators.forEach((ind, index) => {
      stmt.run(
        ind.id, ind.name, ind.unit || "", ind.minNormal ?? null, ind.maxNormal ?? null, ind.color, 
        ind.isActive === false ? 0 : 1, 
        (ind as any).visibleInChart === false ? 0 : 1,
        (ind as any).visibleInList === false ? 0 : 1,
        ind.shortName || null,
        index + 1
      );
    });
  }

  const reportTypeCountStmt = db.prepare('SELECT COUNT(*) as count FROM report_types');
  const reportTypeCount = reportTypeCountStmt.get() as { count: number };
  if (reportTypeCount.count === 0) {
    const defaultTypeId = randomUUID();
    db.prepare('INSERT INTO report_types (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)').run(
      defaultTypeId,
      '默认',
      0,
      new Date().toISOString()
    );
  }

  // Reset processing jobs to pending on startup
  db.prepare(`UPDATE ai_jobs SET status = 'pending' WHERE status = 'processing'`).run();

  // API Routes
  
  // --- Records ---
  app.get('/api/records', (req, res) => {
    const stmt = db.prepare('SELECT * FROM records ORDER BY date DESC');
    const rows = stmt.all() as any[];
    const records = rows.map(row => ({
      id: row.id,
      date: row.date,
      values: JSON.parse(row.values_json),
      notes: row.notes
    }));
    res.json(records);
  });

  app.post('/api/records', (req, res) => {
    const { id, date, values, notes } = req.body;
    const stmt = db.prepare('INSERT INTO records (id, date, values_json, notes) VALUES (?, ?, ?, ?)');
    stmt.run(id, date, JSON.stringify(values), notes);
    res.json({ success: true });
  });

  app.put('/api/records/:id', (req, res) => {
    const { date, values, notes } = req.body;
    const stmt = db.prepare('UPDATE records SET date = ?, values_json = ?, notes = ? WHERE id = ?');
    stmt.run(date, JSON.stringify(values), notes, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/records/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM records WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  // --- Indicators ---
  app.get('/api/indicators', (req, res) => {
    const stmt = db.prepare('SELECT * FROM indicators ORDER BY sort_order ASC');
    const rows = stmt.all() as any[];
    const indicators = rows.map(row => ({
      ...row,
      isActive: Boolean(row.isActive),
      visibleInChart: Boolean(row.visibleInChart),
      visibleInList: Boolean(row.visibleInList)
    }));
    res.json(indicators);
  });

  app.post('/api/indicators', (req, res) => {
    const { id, name, unit, minNormal, maxNormal, color, isActive, visibleInChart, visibleInList, shortName } = req.body;
    const maxOrderStmt = db.prepare('SELECT MAX(sort_order) as maxOrder FROM indicators');
    const maxOrder = (maxOrderStmt.get() as { maxOrder: number | null }).maxOrder ?? 0;
    const stmt = db.prepare('INSERT INTO indicators (id, name, unit, minNormal, maxNormal, color, isActive, visibleInChart, visibleInList, shortName, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, unit || "", minNormal ?? null, maxNormal ?? null, color, isActive === false ? 0 : 1, visibleInChart === false ? 0 : 1, visibleInList === false ? 0 : 1, shortName || null, maxOrder + 1);
    res.json({ success: true });
  });

  app.put('/api/indicators/:id', (req, res) => {
    const { name, unit, minNormal, maxNormal, color, isActive, visibleInChart, visibleInList, shortName } = req.body;
    const stmt = db.prepare('UPDATE indicators SET name = ?, unit = ?, minNormal = ?, maxNormal = ?, color = ?, isActive = ?, visibleInChart = ?, visibleInList = ?, shortName = ? WHERE id = ?');
    stmt.run(name, unit || "", minNormal ?? null, maxNormal ?? null, color, isActive === false ? 0 : 1, visibleInChart === false ? 0 : 1, visibleInList === false ? 0 : 1, shortName || null, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/indicators/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM indicators WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/indicators/reset', (req, res) => {
    db.exec('DELETE FROM indicators');
    const defaultIndicators = [
      { id: "wbc", name: "白细胞计数 (WBC)", unit: "10^9/L", minNormal: 3.5, maxNormal: 9.5, color: "#3b82f6", visibleInList: true, shortName: "白" },
      { id: "hgb", name: "血红蛋白 (HGB)", unit: "g/L", minNormal: 130, maxNormal: 175, color: "#f97316", shortName: "红" },
      { id: "neut", name: "中性粒细胞绝对值 (NEUT#)", unit: "10^9/L", minNormal: 2.8, maxNormal: 6.3, color: "#8b5cf6", shortName: "粒" },
      { id: "plt", name: "血小板计数 (PLT)", unit: "10^9/L", minNormal: 125, maxNormal: 350, color: "#eab308", shortName: "板" },
      { id: "lymph", name: "淋巴细胞绝对值 (LYMPH#)", unit: "10^9/L", minNormal: 1.1, maxNormal: 3.2, color: "#10b981" },
      { id: "mono", name: "单核细胞绝对值 (MONO#)", unit: "10^9/L", minNormal: 0.1, maxNormal: 0.6, color: "#06b6d4" },
      { id: "eo", name: "嗜酸性粒细胞绝对值 (EO#)", unit: "10^9/L", minNormal: 0.02, maxNormal: 0.52, color: "#f43f5e" },
      { id: "baso", name: "嗜碱性粒细胞绝对值 (BASO#)", unit: "10^9/L", minNormal: 0, maxNormal: 0.06, color: "#6366f1" },
      { id: "neut_pct", name: "中性粒细胞百分比 (NEUT%)", unit: "%", minNormal: 40, maxNormal: 75, color: "#a78bfa" },
      { id: "lymph_pct", name: "淋巴细胞百分比 (LYMPH%)", unit: "%", minNormal: 20, maxNormal: 50, color: "#34d399", isActive: true },
      { id: "mono_pct", name: "单核细胞百分比 (MONO%)", unit: "%", minNormal: 3, maxNormal: 10, color: "#67e8f9" },
      { id: "eo_pct", name: "嗜酸性粒细胞百分比 (EO%)", unit: "%", minNormal: 0.4, maxNormal: 8, color: "#fb7185" },
      { id: "baso_pct", name: "嗜碱性粒细胞百分比 (BASO%)", unit: "%", minNormal: 0, maxNormal: 1, color: "#818cf8" },
      { id: "rbc", name: "红细胞计数 (RBC)", unit: "10^12/L", minNormal: 4.3, maxNormal: 5.8, color: "#ef4444" },
      { id: "hct", name: "红细胞压积 (HCT)", unit: "%", minNormal: 40, maxNormal: 50, color: "#fdba74" },
      { id: "mcv", name: "平均红细胞体积 (MCV)", unit: "fL", minNormal: 82, maxNormal: 100, color: "#fca5a5" },
      { id: "mch", name: "平均红细胞血红蛋白量 (MCH)", unit: "pg", minNormal: 27, maxNormal: 34, color: "#f87171", isActive: false },
      { id: "mchc", name: "平均红细胞血红蛋白浓度 (MCHC)", unit: "g/L", minNormal: 316, maxNormal: 354, color: "#dc2626", isActive: false },
      { id: "rdw_cv", name: "红细胞分布宽度 (RDW-CV)", unit: "%", minNormal: 11.5, maxNormal: 14.5, color: "#b91c1c", isActive: false },
      { id: "mpv", name: "平均血小板体积 (MPV)", unit: "fL", minNormal: 6.5, maxNormal: 12, color: "#fef08a", isActive: false },
      { id: "pct", name: "血小板压积 (PCT)", unit: "%", minNormal: 0.1, maxNormal: 0.28, color: "#fde047", isActive: false },
      { id: "pdw", name: "血小板分布宽度 (PDW)", unit: "%", minNormal: 9, maxNormal: 17, color: "#ca8a04", isActive: false },
      { id: "blasts", name: "骨髓原始细胞 (Blasts)", unit: "%", minNormal: 0, maxNormal: 5, color: "#ec4899", isActive: false },
      { id: "custom_1773756216361_97s4x", name: "低密度脂蛋白胆固醇 (LDL-C)", unit: "mmol/L", color: "#14b8a6", isActive: false },
      { id: "custom_1773756439052_bfinc", name: "γ-谷氨酰基转移酶 (GGT)", unit: "U/L ", color: "#ec4899", minNormal: 7, maxNormal: 45, isActive: true },
      { id: "custom_1773756495876_pg45w", name: "高密度脂蛋白胆固醇 (HDL-C)", unit: "mmol/L", minNormal: 1.04, color: "#10b981", isActive: false },
      { id: "custom_1773756678535_smor0", name: "☆甘油三酯 ( TG )", unit: "mmol/L", color: "#3b82f6", isActive: false },
      { id: "custom_1773756998879_ie2xe", name: "☆总胆固醇", unit: "mmol/L", maxNormal: 5.18, color: "#f59e0b", isActive: false },
      { id: "custom_1773757087913_9frul", name: "红细胞分布宽度SD", unit: "fL", minNormal: 37, maxNormal: 54, color: "#14b8a6", isActive: false },
      { id: "custom_1773757260272_kjlio", name: "铁蛋白", unit: "ng/mL", minNormal: 11, maxNormal: 306.8, color: "#14b8a6", isActive: false },
      { id: "custom_1773757260272_9wqp2", name: "尿酸", unit: "μmol/L", minNormal: 155, maxNormal: 357, color: "#3b82f6", isActive: false },
      { id: "custom_1773759019102_0568o", name: "大血小板比值", unit: "", minNormal: 0.13, maxNormal: 0.43, color: "#06b6d4", isActive: false },
      { id: "custom_1773759046914_g8yb3", name: "大血小板比值", unit: "", minNormal: 0.13, maxNormal: 0.43, color: "#f43f5e", isActive: false }
    ];
    const stmt = db.prepare('INSERT INTO indicators (id, name, unit, minNormal, maxNormal, color, isActive, visibleInChart, visibleInList, shortName, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    defaultIndicators.forEach((ind, index) => {
      stmt.run(
        ind.id, ind.name, ind.unit || "", ind.minNormal ?? null, ind.maxNormal ?? null, ind.color, 
        ind.isActive === false ? 0 : 1, 
        (ind as any).visibleInChart === false ? 0 : 1,
        (ind as any).visibleInList === false ? 0 : 1,
        ind.shortName || null,
        index + 1
      );
    });
    res.json({ success: true });
  });

  app.post('/api/indicators/reorder', (req, res) => {
    const { ids } = req.body as { ids?: string[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids required' });
    }
    const update = db.prepare('UPDATE indicators SET sort_order = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
      ids.forEach((id, index) => {
        update.run(index + 1, id);
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      return res.status(500).json({ error: 'reorder failed' });
    }
    res.json({ success: true });
  });

  // --- Report Types ---
  app.get('/api/report-types', (req, res) => {
    const stmt = db.prepare('SELECT * FROM report_types ORDER BY sort_order ASC, created_at ASC');
    const rows = stmt.all() as any[];
    res.json(rows);
  });

  app.post('/api/report-types', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const maxOrderStmt = db.prepare('SELECT MAX(sort_order) as maxOrder FROM report_types');
    const maxOrder = (maxOrderStmt.get() as { maxOrder: number | null }).maxOrder ?? 0;
    const id = randomUUID();
    db.prepare('INSERT INTO report_types (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      String(name).trim(),
      maxOrder + 1,
      new Date().toISOString()
    );
    res.json({ id, name });
  });

  app.put('/api/report-types/:id', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    db.prepare('UPDATE report_types SET name = ? WHERE id = ?').run(String(name).trim(), req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/report-types/:id', (req, res) => {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM report_files WHERE type_id = ?');
    const count = countStmt.get(req.params.id) as { count: number };
    if (count.count > 0) {
      return res.status(409).json({ error: 'type_in_use' });
    }
    db.prepare('DELETE FROM report_types WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- Report Files ---
  app.get('/api/report-files', (req, res) => {
    const typeId = req.query.type_id as string | undefined;
    let rows: any[] = [];
    if (typeId) {
      const stmt = db.prepare(`
        SELECT rf.*, rt.name as typeName
        FROM report_files rf
        LEFT JOIN report_types rt ON rt.id = rf.type_id
        WHERE rf.type_id = ?
        ORDER BY rf.created_at DESC
      `);
      rows = stmt.all(typeId) as any[];
    } else {
      const stmt = db.prepare(`
        SELECT rf.*, rt.name as typeName
        FROM report_files rf
        LEFT JOIN report_types rt ON rt.id = rf.type_id
        ORDER BY rf.created_at DESC
      `);
      rows = stmt.all() as any[];
    }
    res.json(rows);
  });

  app.post('/api/report-files', uploadReport.single('file'), (req, res) => {
    const file = req.file;
    const { typeId, date, title } = req.body as { typeId?: string; date?: string; title?: string };
    if (!file) return res.status(400).json({ error: 'file is required' });
    if (!typeId) return res.status(400).json({ error: 'typeId is required' });

    const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
    const id = randomUUID();
    db.prepare(
      'INSERT INTO report_files (id, type_id, date, title, file_path, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      typeId,
      date || null,
      title || originalName || file.originalname,
      file.path,
      originalName || file.originalname,
      file.mimetype,
      file.size,
      new Date().toISOString()
    );
    res.json({ id });
  });

  app.get('/api/report-files/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM report_files WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    if (row.mime) res.type(row.mime);
    res.sendFile(row.file_path);
  });

  app.delete('/api/report-files/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM report_files WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    try {
      fs.unlinkSync(row.file_path);
    } catch (e) {
      // ignore missing file
    }
    db.prepare('DELETE FROM report_files WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.put('/api/report-files/:id', (req, res) => {
    const { typeId, date, title } = req.body as { typeId?: string; date?: string; title?: string };
    db.prepare('UPDATE report_files SET type_id = ?, date = ?, title = ? WHERE id = ?').run(
      typeId,
      date || null,
      title || null,
      req.params.id
    );
    res.json({ success: true });
  });

  // --- Admin Settings ---
  app.get('/api/admin/ai-provider', (_req, res) => {
    const provider = getSetting('ai_provider', 'gemini');
    res.json({ provider });
  });

  app.put('/api/admin/ai-provider', (req, res) => {
    const { provider } = req.body as { provider?: string };
    if (!provider || !['gemini', 'codex'].includes(provider)) {
      return res.status(400).json({ error: 'invalid provider' });
    }
    setSetting('ai_provider', provider);
    res.json({ success: true });
  });

  // --- AI Jobs ---
  app.post('/api/ai-jobs', uploadAi.single('file'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file is required' });
    const id = randomUUID();
    const now = new Date().toISOString();
    const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
    db.prepare(
      'INSERT INTO ai_jobs (id, status, attempts, file_path, original_name, mime, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      'pending',
      0,
      file.path,
      originalName || file.originalname,
      file.mimetype,
      now,
      now
    );
    res.json({ id });
  });

  app.get('/api/ai-jobs', (req, res) => {
    const stmt = db.prepare('SELECT * FROM ai_jobs ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    const jobs = rows.map(row => ({
      ...row,
      result: row.result_json ? JSON.parse(row.result_json) : null,
      conflict: row.conflict_json ? JSON.parse(row.conflict_json) : null
    }));
    res.json(jobs);
  });

  app.get('/api/ai-jobs/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM ai_jobs WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    res.json({
      ...row,
      result: row.result_json ? JSON.parse(row.result_json) : null,
      conflict: row.conflict_json ? JSON.parse(row.conflict_json) : null
    });
  });

  app.get('/api/ai-jobs/:id/file', (req, res) => {
    const stmt = db.prepare('SELECT * FROM ai_jobs WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    if (!row.file_path || !fs.existsSync(row.file_path)) {
      res.type('image/svg+xml');
      return res.send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
          <rect width="100%" height="100%" fill="#f1f5f9"/>
          <rect x="24" y="24" width="432" height="272" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
          <text x="50%" y="48%" text-anchor="middle" font-size="16" fill="#64748b" font-family="Arial, sans-serif">文件已不存在</text>
          <text x="50%" y="58%" text-anchor="middle" font-size="12" fill="#94a3b8" font-family="Arial, sans-serif">请重新上传或删除任务</text>
        </svg>
      `);
    }
    if (row.mime) res.type(row.mime);
    res.sendFile(row.file_path);
  });

  app.post('/api/ai-jobs/:id/resolve', (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !['saved', 'ignored'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    db.prepare('UPDATE ai_jobs SET status = ?, updated_at = ? WHERE id = ?').run(
      status,
      new Date().toISOString(),
      req.params.id
    );
    res.json({ success: true });
  });

  app.delete('/api/ai-jobs/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM ai_jobs WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    try {
      fs.unlinkSync(row.file_path);
    } catch (e) {
      // ignore missing file
    }
    db.prepare('DELETE FROM ai_jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/ai-jobs/:id/retry', (req, res) => {
    const stmt = db.prepare('SELECT * FROM ai_jobs WHERE id = ?');
    const row = stmt.get(req.params.id) as any;
    if (!row) return res.status(404).end();
    if (!row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(400).json({ error: 'FILE_MISSING' });
    }
    db.prepare('UPDATE ai_jobs SET status = ?, attempts = ?, error = NULL, result_json = NULL, conflict_json = NULL, updated_at = ? WHERE id = ?').run(
      'pending',
      0,
      new Date().toISOString(),
      req.params.id
    );
    res.json({ success: true });
  });

  const AI_TIMEOUT_MS = 120000;
  const AI_MAX_ATTEMPTS = 3;
  const processingJobs = new Set<string>();

  const buildAiPrompt = (indicators: { id: string; name: string }[]) => `
      请分析这张医疗化验单图片，提取以下信息：
      1. 检查日期 (YYYY-MM-DD格式)
      2. 所有的化验指标数据。

      【极其重要 - 核心指标】：请务必优先且准确地提取以下四个核心指标（只要化验单上有）：
      - 白细胞 (WBC)
      - 血红蛋白 (HGB)
      - 中性粒细胞计数 (NEUT#)
      - 血小板 (PLT)

      【极其重要 - 全面提取】：除了上述核心指标，请务必逐行扫描表格，提取出表格中的**每一项**化验指标！不要遗漏任何一行数据（例如：铁蛋白、尿酸、总胆固醇、甘油三酯、高密度脂蛋白胆固醇、低密度脂蛋白胆固醇等，只要在表格里就必须全部提取）。

      注意：
      1. 请仅提取表格中的实际化验指标！忽略页眉、页脚、医院名称、联系方式、备注说明等无关文本。
      2. 提取指标名称时，请去除名称前后的特殊符号（如☆、*等）和英文缩写（如(UA)、(TC)等），只保留纯中文名称（例如，将"☆尿酸 ( UA )"提取为"尿酸"）。

      我已经有一些预设的指标，列表如下：
      ${indicators.map(i => `- ID: ${i.id}, 名称: ${i.name}`).join('\n')}

      对于图片中提取到的每一个指标：
      - 如果它能对应上预设列表中的某个指标，请提供该指标的 'matchedId'。
      - 如果它是预设列表中没有的新指标，请不要提供 'matchedId'，但必须提供它的 'name' (名称), 'unit' (单位), 以及参考范围的 'minNormal' 和 'maxNormal' (如果有的话)。名称和单位必须简短（不超过20个字符）。
      - 必须提供提取到的数值 'value'。
    `;

  const runGeminiRecognition = async (filePath: string, mimeType: string) => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY_MISSING');
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64 = fs.readFileSync(filePath).toString('base64');
    const parts = [{
      inlineData: {
        data: base64,
        mimeType: mimeType || 'application/octet-stream'
      }
    }];

    const indicators = db.prepare('SELECT id, name FROM indicators').all() as { id: string; name: string }[];
    const prompt = buildAiPrompt(indicators);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), AI_TIMEOUT_MS);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...parts, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "检查日期，格式 YYYY-MM-DD" },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    matchedId: { type: Type.STRING, description: "如果匹配到预设指标，填入对应的ID" },
                    name: { type: Type.STRING, description: "指标名称（简短，如'白细胞'）" },
                    value: { type: Type.NUMBER, description: "检测数值" },
                    unit: { type: Type.STRING, description: "单位（简短，如'10^9/L'）" },
                    minNormal: { type: Type.NUMBER, description: "正常范围下限" },
                    maxNormal: { type: Type.NUMBER, description: "正常范围上限" }
                  },
                  required: ["name", "value"]
                }
              }
            }
          }
        }
      }),
      timeoutPromise
    ]) as any;

    const resultText = response.text || '{}';
    return JSON.parse(resultText);
  };

  const runCodexRecognition = async (filePath: string, mimeType: string) => {
    if (!process.env.CODEX_API_KEY) {
      throw new Error('CODEX_API_KEY_MISSING');
    }
    const url = process.env.CODEX_API_BASE_URL || 'http://8.134.251.152:3200/vision/medical';
    const t0 = Date.now();
    const logPrefix = `[codex]`;
    console.log(`${logPrefix} start file=${path.basename(filePath)} url=${url}`);
    const indicators = db.prepare('SELECT id, name FROM indicators').all() as { id: string; name: string }[];
    const prompt = buildAiPrompt(indicators);

    const tReadStart = Date.now();
    const buffer = fs.readFileSync(filePath);
    console.log(`${logPrefix} read_file_ms=${Date.now() - tReadStart}`);
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
    const form = new FormData();
    const filename = `upload${path.extname(filePath) || ''}`;
    form.append('file', blob, filename);
    form.append('indicators', JSON.stringify(indicators));
    form.append('prompt', prompt);
    form.append('timeoutMs', String(AI_TIMEOUT_MS));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS + 5000);
    let res: Response;
    try {
      const tReqStart = Date.now();
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-auth-token': process.env.CODEX_API_KEY
        },
        body: form,
        signal: controller.signal
      });
      console.log(`${logPrefix} response_ms=${Date.now() - tReqStart} status=${res.status}`);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log(`${logPrefix} timeout_ms=${Date.now() - t0}`);
        throw new Error('TIMEOUT');
      }
      console.log(`${logPrefix} fetch_error=${error?.message || error}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }

    const tJsonStart = Date.now();
    const data = await res.json().catch(() => null);
    console.log(`${logPrefix} json_parse_ms=${Date.now() - tJsonStart}`);
    if (!res.ok || !data?.ok) {
      const message = data?.error || `CODEX_REQUEST_FAILED_${res.status}`;
      if (message === 'timeout') {
        throw new Error('TIMEOUT');
      }
      console.log(`${logPrefix} api_error=${message}`);
      throw new Error(message);
    }

    const payload = data.data || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (typeof payload.checkDate !== 'string' || items.length === 0) {
      console.log(`${logPrefix} invalid_json raw=${String(data?.raw || '').slice(0, 500)}`);
      throw new Error('INVALID_JSON_RESPONSE');
    }
    console.log(`${logPrefix} done total_ms=${Date.now() - t0}`);
    return {
      date: payload.checkDate || payload.date || '',
      items
    };
  };

  const runAiRecognition = async (filePath: string, mimeType: string) => {
    const provider = getSetting('ai_provider', 'gemini');
    if (provider === 'codex') {
      return runCodexRecognition(filePath, mimeType);
    }
    return runGeminiRecognition(filePath, mimeType);
  };

  const processJob = async (job: any) => {
    if (processingJobs.has(job.id)) return;
    processingJobs.add(job.id);
    const attempt = (job.attempts || 0) + 1;
    const now = new Date().toISOString();
    db.prepare('UPDATE ai_jobs SET status = ?, attempts = ?, updated_at = ? WHERE id = ?').run(
      'processing',
      attempt,
      now,
      job.id
    );

    try {
      const result = await runAiRecognition(job.file_path, job.mime);
      const indicators = db.prepare('SELECT id FROM indicators').all() as { id: string }[];
      const indicatorIds = new Set(indicators.map(i => i.id));

      const newValues: Record<string, number> = {};
      const newIndicators: any[] = [];
      const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];

      if (result.items && Array.isArray(result.items)) {
        result.items.forEach((resItem: any) => {
          if (resItem.value === null || resItem.value === undefined) return;
          if (resItem.matchedId && indicatorIds.has(resItem.matchedId)) {
            newValues[resItem.matchedId] = Number(resItem.value);
          } else if (resItem.name && typeof resItem.name === 'string' && resItem.name.length <= 30) {
            const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const newIndicator = {
              id: newId,
              name: resItem.name.trim(),
              unit: (resItem.unit && typeof resItem.unit === 'string') ? resItem.unit.substring(0, 20).trim() : '',
              minNormal: resItem.minNormal,
              maxNormal: resItem.maxNormal,
              color: colors[Math.floor(Math.random() * colors.length)]
            };
            newIndicators.push(newIndicator);
            newValues[newId] = Number(resItem.value);
          }
        });
      }

      const extractedDate = result.date || new Date().toISOString().split('T')[0];
      const existingRow = db.prepare('SELECT * FROM records WHERE date = ? LIMIT 1').get(extractedDate) as any;
      let conflict = null as any;
      let status = 'success';
      let mergeRecordId: string | null = null;

      if (existingRow) {
        const existingValues = JSON.parse(existingRow.values_json || '{}');
        const diffs = Object.entries(newValues).filter(([key, value]) => {
          return existingValues[key] !== undefined && Number(existingValues[key]) !== Number(value);
        }).map(([key, value]) => ({
          indicatorId: key,
          oldValue: existingValues[key],
          newValue: value
        }));
        if (diffs.length > 0) {
          conflict = {
            recordId: existingRow.id,
            diffs
          };
          status = 'conflict';
        } else {
          mergeRecordId = existingRow.id;
        }
      }

      const resultPayload = {
        date: extractedDate,
        values: newValues,
        newIndicators,
        ...(mergeRecordId ? { mergeRecordId } : {})
      };

      db.prepare('UPDATE ai_jobs SET status = ?, date = ?, result_json = ?, conflict_json = ?, error = NULL, updated_at = ? WHERE id = ?').run(
        status,
        extractedDate,
        JSON.stringify(resultPayload),
        conflict ? JSON.stringify(conflict) : null,
        new Date().toISOString(),
        job.id
      );
    } catch (error: any) {
      let message = error?.message || '识别失败';
      if (message === 'TIMEOUT') {
        message = '识别超时';
      } else if (message === 'CODEX_API_KEY_MISSING') {
        message = 'Codex Key 未配置';
      } else if (message === 'GEMINI_API_KEY_MISSING') {
        message = 'Gemini Key 未配置';
      } else if (message === 'INVALID_JSON_RESPONSE') {
        message = 'invalid json response';
      }
      const failed = attempt >= AI_MAX_ATTEMPTS;
      db.prepare('UPDATE ai_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?').run(
        failed ? 'error' : 'pending',
        message,
        new Date().toISOString(),
        job.id
      );
    } finally {
      processingJobs.delete(job.id);
    }
  };

  const pollJobs = async () => {
    if (processingJobs.size >= 2) return;
    const stmt = db.prepare(`SELECT * FROM ai_jobs WHERE status IN ('pending', 'processing') AND attempts < ? ORDER BY created_at ASC LIMIT 2`);
    const rows = stmt.all(AI_MAX_ATTEMPTS) as any[];
    for (const row of rows) {
      if (!processingJobs.has(row.id)) {
        processJob(row);
      }
    }
  };

  setInterval(pollJobs, 3000);
  pollJobs();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
