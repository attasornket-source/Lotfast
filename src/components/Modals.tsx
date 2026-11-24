import React, { useState } from 'react';
import {
  Download,
  Radio,
  RefreshCw,
  Share,
  X,
} from 'lucide-react';
import {
  APP_CONFIG,
  type MetaApiDirectConfig,
  type Mt5LaunchMode,
  type VantageAccountType,
} from '../config/tradingConfig';
import { isValidPin } from '../utils/calculator';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface RiskModalProps {
  isOpen: boolean;
  riskUsd: number;
  onClose: () => void;
  onSave: (risk: number) => void;
}

export const RiskLimitModal: React.FC<RiskModalProps> = ({
  isOpen,
  riskUsd,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState(String(riskUsd));
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setDraft(String(riskUsd));
      setError('');
    }
  }, [isOpen, riskUsd]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number.parseFloat(draft);
    if (!Number.isFinite(val) || val <= 0) {
      setError('กรุณากรอกจำนวนเงิน Risk มากกว่า $0');
      return;
    }
    onSave(Number(val.toFixed(2)));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ตั้งค่า Risk Limit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl border border-white/[0.1] bg-[#0F1520] p-5 pb-safe sm:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">
            ตั้งค่า Risk Limit (ไม้ 1 + ไม้ 2)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง Risk Limit"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {APP_CONFIG.RISK_PRESETS.map((preset) => {
            const active = preset === riskUsd;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onSave(preset);
                  onClose();
                }}
                className={`min-h-[44px] rounded-xl border font-mono text-sm font-bold transition-colors ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/[0.15] text-emerald-300'
                    : 'border-white/[0.08] bg-[#080C12] text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                ${preset}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="custom-risk-input"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              หรือกำหนดเอง (USD)
            </label>
            <input
              id="custom-risk-input"
              type="number"
              inputMode="decimal"
              step="any"
              min="1"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
              className="w-full rounded-xl border border-white/[0.1] bg-[#080C12] px-3.5 py-3 font-mono text-lg font-bold text-slate-100 outline-none focus:border-emerald-400"
              placeholder="30"
            />
            {error && (
              <p role="alert" className="mt-1.5 text-xs text-rose-400">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="min-h-[48px] w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-[#04140D] transition-colors hover:bg-emerald-300 active:scale-[0.98]"
          >
            บันทึก Risk Limit
          </button>
        </form>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePin: (newPin: string) => void;
  onForceUpdate: () => void;
  usdJpyRate: number;
  vantageAccountType: VantageAccountType;
  onChangeVantageAccountType: (type: VantageAccountType) => void;
  mt5LaunchMode: Mt5LaunchMode;
  onChangeMt5LaunchMode: (mode: Mt5LaunchMode) => void;
  metaApiConfig: MetaApiDirectConfig;
  onSaveMetaApiConfig: (cfg: MetaApiDirectConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSavePin,
  onForceUpdate,
  usdJpyRate,
  vantageAccountType,
  onChangeVantageAccountType,
  mt5LaunchMode,
  onChangeMt5LaunchMode,
  metaApiConfig,
  onSaveMetaApiConfig,
}) => {
  const [pinDraft, setPinDraft] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [metaEnabled, setMetaEnabled] = useState(metaApiConfig.enabled);
  const [metaToken, setMetaToken] = useState(metaApiConfig.token);
  const [metaAccountId, setMetaAccountId] = useState(metaApiConfig.accountId);
  const [metaRegion, setMetaRegion] = useState<MetaApiDirectConfig['region']>(
    metaApiConfig.region
  );
  const [metaSavedMsg, setMetaSavedMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setPinDraft('');
      setPinFeedback(null);
      setMetaEnabled(metaApiConfig.enabled);
      setMetaToken(metaApiConfig.token);
      setMetaAccountId(metaApiConfig.accountId);
      setMetaRegion(metaApiConfig.region);
      setMetaSavedMsg('');
    }
  }, [isOpen, metaApiConfig]);

  if (!isOpen) return null;

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinDraft.trim();
    if (!isValidPin(cleaned)) {
      setPinFeedback({
        type: 'err',
        text: 'กรุณากรอกรหัส PIN เป็นตัวเลข 4 หลักเท่านั้น',
      });
      return;
    }
    onSavePin(cleaned);
    setPinDraft('');
    setPinFeedback({
      type: 'ok',
      text: 'บันทึกรหัส PIN ใหม่เรียบร้อยแล้ว (มีผลบนเครื่องนี้)',
    });
  };

  const handleSaveMetaApi = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveMetaApiConfig({
      enabled: metaEnabled && Boolean(metaToken.trim() && metaAccountId.trim()),
      token: metaToken.trim(),
      accountId: metaAccountId.trim(),
      region: metaRegion,
    });
    setMetaSavedMsg(
      metaEnabled && metaToken.trim() && metaAccountId.trim()
        ? 'เปิดใช้งานฟีดตรง Vantage MT5 Direct แล้ว'
        : 'บันทึกการตั้งค่าแล้ว (ใช้ฟีด Live WebSocket อัตโนมัติ)'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ตั้งค่าและความปลอดภัย"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/[0.1] bg-[#0F1520] p-5 pb-safe sm:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">
            ตั้งค่า & ฟีดราคา Vantage
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าตั้งค่า"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* System Spec Summary */}
        <div className="mt-3.5 space-y-1.5 rounded-xl border border-white/[0.07] bg-[#080C12] p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">เวอร์ชันแอป</span>
            <strong className="font-mono text-emerald-300">
              {APP_CONFIG.VERSION} ({APP_CONFIG.RELEASE_DATE})
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">โบรกเกอร์</span>
            <strong className="text-slate-100">{APP_CONFIG.BROKER_NAME}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">เรท USDJPY สด</span>
            <strong className="font-mono text-emerald-400 tabular-nums">
              {usdJpyRate.toFixed(3)}
            </strong>
          </div>
        </div>

        {/* Vantage Account Type Switch */}
        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">
            ประเภทสเปรดโบรก Vantage (โหมด Live WebSocket)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'RAW', title: 'Raw ECN', desc: 'สเปรดแคบ (VANTAGE)' },
                { id: 'STD', title: 'Standard STP', desc: 'ฟรีค่าคอม (VANTAGE.TV)' },
              ] as const
            ).map((opt) => {
              const active = vantageAccountType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeVantageAccountType(opt.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-emerald-400/70 bg-emerald-500/[0.14]'
                      : 'border-white/[0.08] bg-[#080C12] hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`block text-xs font-bold ${
                      active ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    {opt.title}
                  </span>
                  <span className="block text-[10.5px] text-slate-400">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional 1:1 Direct Vantage MT5 Feed via MetaApi Cloud */}
        <form
          onSubmit={handleSaveMetaApi}
          className="mt-4 space-y-2.5 rounded-xl border border-emerald-500/25 bg-[#080C12] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-xs font-bold text-slate-100">
                เชื่อมราคาตรง Vantage MT5 1:1 (MetaApi)
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={metaEnabled}
                onChange={(e) => setMetaEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
              <span>เปิดใช้</span>
            </label>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            เสริมสำหรับดึง Bid/Offer ตรงจากเซิร์ฟเวอร์ Vantage MT5 ของคุณทุก 1 วินาที (เก็บ Token เฉพาะในเครื่อง iPhone นี้เท่านั้น)
          </p>
          {metaEnabled && (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                placeholder="MetaApi Account ID (เช่น 4a7b...)"
                aria-label="MetaApi Account ID"
                className="w-full rounded-lg border border-white/[0.1] bg-[#0F1520] px-2.5 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400"
              />
              <input
                type="password"
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
                placeholder="MetaApi API Token"
                aria-label="MetaApi API Token"
                className="w-full rounded-lg border border-white/[0.1] bg-[#0F1520] px-2.5 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400"
              />
              <div className="flex gap-2">
                <select
                  value={metaRegion}
                  onChange={(e) =>
                    setMetaRegion(e.target.value as MetaApiDirectConfig['region'])
                  }
                  aria-label="MetaApi Region"
                  className="flex-1 rounded-lg border border-white/[0.1] bg-[#0F1520] px-2.5 py-2 text-xs text-slate-100 outline-none"
                >
                  <option value="singapore">Region: Singapore</option>
                  <option value="london">Region: London</option>
                  <option value="new-york">Region: New York</option>
                  <option value="vint-hill">Region: Vint Hill</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-extrabold text-[#04140D]"
                >
                  บันทึกฟีด
                </button>
              </div>
            </div>
          )}
          {!metaEnabled && metaApiConfig.enabled && (
            <button
              type="submit"
              className="w-full rounded-lg bg-white/[0.08] py-1.5 text-xs font-bold text-slate-200"
            >
              สลับกลับใช้ Live WebSocket อัตโนมัติ
            </button>
          )}
          {metaSavedMsg && (
            <p className="text-[11px] font-medium text-emerald-400">
              {metaSavedMsg}
            </p>
          )}
        </form>

        {/* MT5 Shortcut Launch Mode */}
        <div className="mt-4">
          <label
            htmlFor="mt5-launch-mode"
            className="mb-1.5 block text-xs font-medium text-slate-400"
          >
            รูปแบบปุ่มคีย์ลัดเปิดแอป MT5 บน iPhone
          </label>
          <select
            id="mt5-launch-mode"
            value={mt5LaunchMode}
            onChange={(e) => onChangeMt5LaunchMode(e.target.value as Mt5LaunchMode)}
            className="w-full rounded-xl border border-white/[0.1] bg-[#080C12] px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-emerald-400"
          >
            <option value="app_scheme" className="bg-[#0F1520]">
              เปิดแอป MT5 โดยตรง (metatrader5://) — แนะนำสำหรับ iPhone
            </option>
            <option value="universal" className="bg-[#0F1520]">
              Vantage MT5 iOS Smart Link (เชื่อมเซิร์ฟเวอร์ Vantage)
            </option>
            <option value="web_terminal" className="bg-[#0F1520]">
              MT5 WebTerminal (เปิดบนเบราว์เซอร์)
            </option>
          </select>
        </div>

        {/* Change 4-digit PIN */}
        <form onSubmit={handleSavePin} className="mt-4 space-y-2">
          <label
            htmlFor="new-pin-field"
            className="block text-xs font-medium text-slate-400"
          >
            เปลี่ยนรหัส PIN 4 หลัก (ค่าเริ่มต้นคือ {APP_CONFIG.DEFAULT_PIN})
          </label>
          <div className="flex gap-2">
            <input
              id="new-pin-field"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinDraft}
              onChange={(e) => {
                setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPinFeedback(null);
              }}
              placeholder="กรอกเลข 4 หลัก"
              className="flex-1 rounded-xl border border-white/[0.1] bg-[#080C12] px-3.5 py-2.5 font-mono text-base font-bold tracking-widest text-slate-100 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-xl bg-white/[0.1] px-4 text-xs font-bold text-slate-100 hover:bg-white/[0.16]"
            >
              บันทึก PIN
            </button>
          </div>
          {pinFeedback && (
            <p
              role="status"
              className={`text-xs ${
                pinFeedback.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {pinFeedback.text}
            </p>
          )}
        </form>

        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
          <PWAInstallButton fullWidth showAlwaysGuide />
          <button
            type="button"
            onClick={onForceUpdate}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.1]"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>ตรวจสอบและอัปเดตเวอร์ชันล่าสุด</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  fullWidth?: boolean;
  showAlwaysGuide?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  fullWidth = false,
  showAlwaysGuide = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-extrabold text-[#04140D] hover:bg-emerald-300 ${
          fullWidth ? 'w-full' : ''
        }`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>ติดตั้งแอปลงเครื่อง</span>
      </button>
    );
  }

  if (isIOS || showAlwaysGuide) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-500/35 bg-emerald-500/[0.1] px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/[0.18] ${
            fullWidth ? 'w-full' : ''
          }`}
        >
          <Share className="h-3.5 w-3.5" aria-hidden="true" />
          <span>วิธีติดตั้งบน iPhone</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="วิธีติดตั้งแอปลงหน้าจอโฮม iPhone"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGuide(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#0F1520] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100">
                  ติดตั้ง LotFast บน iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="ปิดคู่มือติดตั้ง"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
                <li>
                  1. เปิดลิงก์แอปนี้ด้วยเบราว์เซอร์ <strong>Safari</strong> บน iPhone
                </li>
                <li>
                  2. กดปุ่ม <strong>Share (สี่เหลี่ยมลูกศรขึ้น)</strong> ด้านล่างจอ
                </li>
                <li>
                  3. แตะ <strong>Add to Home Screen (เพิ่มไปยังหน้าจอโฮม)</strong>
                </li>
                <li>
                  4. กด <strong>Add</strong> — เปิดใช้งานเต็มจอได้ทันที (PIN: <strong className="font-mono">{APP_CONFIG.DEFAULT_PIN}</strong>)
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 min-h-[44px] w-full rounded-xl bg-emerald-400 py-2.5 text-xs font-extrabold text-[#04140D]"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
