import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, ShieldCheck } from 'lucide-react';
import { APP_CONFIG, type AppTheme } from '../config/tradingConfig';
import { LotFastLogo } from './LotFastLogo';

interface PinLockScreenProps {
  expectedPin: string;
  theme: AppTheme;
  onUnlock: () => void;
}

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'] as const;

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  expectedPin,
  theme,
  onUnlock,
}) => {
  const [buffer, setBuffer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lockUntil <= Date.now()) {
      setCooldownSec(0);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setCooldownSec(rem);
      if (rem === 0) {
        setErrorMsg('');
        setFailCount(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const handleDigit = useCallback(
    (key: string) => {
      if (Date.now() < lockUntil) {
        return;
      }

      if (key === 'DEL') {
        setBuffer((prev) => prev.slice(0, -1));
        setErrorMsg('');
        setIsError(false);
        return;
      }

      if (!/^\d$/.test(key)) return;

      setBuffer((prev) => {
        if (prev.length >= 4) return prev;
        const next = `${prev}${key}`;
        setErrorMsg('');
        setIsError(false);

        if (next.length === 4) {
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
          }
          if (next === expectedPin) {
            setFailCount(0);
            timeoutRef.current = window.setTimeout(() => {
              setBuffer('');
              onUnlock();
            }, 90);
          } else {
            setFailCount((prevFails) => {
              const nextFails = prevFails + 1;
              if (nextFails >= 5) {
                const until = Date.now() + 15_000;
                setLockUntil(until);
                setErrorMsg('รหัสไม่ถูกต้อง 5 ครั้ง ล็อกชั่วคราว 15 วินาที');
              } else {
                setErrorMsg('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่');
              }
              return nextFails;
            });
            setIsError(true);
            timeoutRef.current = window.setTimeout(() => {
              setBuffer('');
              setIsError(false);
            }, 340);
          }
        }
        return next;
      });
    },
    [expectedPin, lockUntil, onUnlock]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDigit('DEL');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDigit]);

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col items-center justify-between overflow-hidden overscroll-none bg-terminal-grid px-6 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label="หน้าล็อกรหัส PIN"
    >
      <div className="mt-8 flex flex-col items-center text-center sm:mt-14">
        <LotFastLogo size="lg" showWordmark={false} theme={theme} className="mb-3.5" />
        <h1 className="font-display flex items-baseline justify-center gap-1.5 text-2xl font-extrabold tracking-tight text-slate-50">
          <LotFastLogo size="md" showIcon={false} showWordmark theme={theme} />
          <span className="text-base font-semibold text-slate-400">Terminal</span>
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="accent-text h-3.5 w-3.5" aria-hidden="true" />
          <span>ใส่รหัส PIN 4 หลักเพื่อเข้าใช้งาน</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-slate-300">{APP_CONFIG.VERSION}</span>
        </p>
      </div>

      <div className="my-4 flex flex-col items-center">
        <div
          className={`flex items-center gap-4 ${isError ? 'animate-pin-shake' : ''}`}
          aria-label={`กรอกแล้ว ${buffer.length} จาก 4 หลัก`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < buffer.length;
            return (
              <span
                key={idx}
                className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                  isError
                    ? 'border-rose-500 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                    : filled
                      ? 'scale-110 border-[var(--lf-accent)] bg-[var(--lf-accent)] shadow-[0_0_14px_var(--lf-accent-glow)]'
                      : 'border-slate-600 bg-transparent'
                }`}
              />
            );
          })}
        </div>
        <p
          role="alert"
          className="mt-3.5 min-h-[20px] text-center text-xs font-medium text-rose-400"
        >
          {cooldownSec > 0
            ? `กรุณารอ ${cooldownSec} วินาทีก่อนลองใหม่`
            : errorMsg}
        </p>
      </div>

      <div className="mb-6 grid w-full max-w-[272px] grid-cols-3 gap-3.5 sm:mb-12">
        {PIN_KEYS.map((key, index) => {
          if (key === '') {
            return <div key={`empty-${index}`} aria-hidden="true" />;
          }
          if (key === 'DEL') {
            return (
              <button
                key="DEL"
                type="button"
                onClick={() => handleDigit('DEL')}
                aria-label="ลบตัวเลข PIN"
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lf-accent)]"
              >
                <Delete className="h-6 w-6" aria-hidden="true" />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleDigit(key)}
              disabled={cooldownSec > 0}
              aria-label={`PIN ${key}`}
              className="numpad-key mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.09] font-mono text-2xl font-semibold text-slate-100 transition-transform duration-100 hover:border-[var(--lf-accent-border)] active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lf-accent)]"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};
