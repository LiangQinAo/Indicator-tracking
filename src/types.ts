export interface Indicator {
  id: string;
  name: string;
  shortName?: string;
  unit: string;
  minNormal?: number;
  maxNormal?: number;
  color: string;
  isActive?: boolean;
  visibleInList?: boolean;
  visibleInChart?: boolean;
}

export interface MedicalRecord {
  id: string;
  date: string; // ISO string
  values: {
    [indicatorId: string]: number;
  };
  notes?: string;
}

export const DEFAULT_INDICATORS: Indicator[] = [
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
