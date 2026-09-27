import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, RotateCcw, Server, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '../utils/helpers';
import type { Settings } from '../types';

type Tab = 'terms' | 'refund' | 'info';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'terms', label: 'Соглашение', icon: FileText },
  { id: 'refund', label: 'Возврат', icon: RotateCcw },
  { id: 'info', label: 'О сервисе', icon: Server },
];

function LegalText({ text, fallback }: { text?: string; fallback: string }) {
  if (!text || !text.trim()) {
    return <p className="text-muted-foreground">{fallback}</p>;
  }
  return (
    <div className="space-y-4 text-muted-foreground">
      {text.split(/\n{2,}/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('# ')) {
          return <h3 key={index} className="font-semibold text-foreground text-lg">{trimmed.slice(2)}</h3>;
        }
        if (/^\d+\.\s/.test(trimmed)) {
          return <p key={index} className="leading-relaxed">{trimmed}</p>;
        }
        if (/^[•\-]\s/.test(trimmed)) {
          return (
            <ul key={index} className="list-disc pl-5 space-y-1">
              {trimmed.split('\n').filter(Boolean).map((line, i) => (
                <li key={i}>{line.replace(/^[•\-]\s*/, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={index} className="leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('page');
  const page: Tab = raw === 'refund' || raw === 'info' ? raw : 'terms';

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then(response => {
        if (active && response.success && response.data?.settings) {
          setSettings(response.data.settings);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Информация и соглашения сервиса</p>
        </div>

        {/* Tab switcher pinned to top right */}
        <div className="p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-x-auto scrollbar-thin flex items-center gap-1 self-start sm:self-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/settings?page=${id}`}
              className={cn(
                'px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg inline-flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap',
                page === id
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm border border-zinc-700/70'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="card overflow-hidden">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : page === 'terms' ? (
            <>
              <h2 className="text-xl font-bold mb-4">Пользовательское соглашение</h2>
              <LegalText
                text={settings?.terms_text}
                fallback="Текст соглашения пока не задан. Его можно изменить в разделе админки → Настройки."
              />
            </>
          ) : page === 'refund' ? (
            <>
              <h2 className="text-xl font-bold mb-4">Правила возврата</h2>
              <LegalText
                text={settings?.refund_text}
                fallback="Текст правил возврата пока не задан. Его можно изменить в разделе админки → Настройки."
              />
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-4">О сервисе</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Название', value: settings?.site_name || 'Mintaly' },
                  {
                    label: 'Регистрация',
                    value: settings?.registration_open === '1' ? 'открыта' : 'закрыта',
                  },
                  {
                    label: 'Форум',
                    value: settings?.forum_open === '1' ? 'открыт' : 'закрыт',
                  },
                  {
                    label: 'Обслуживание',
                    value: settings?.maintenance === '1' ? 'включено' : 'выключено',
                  },
                  { label: 'Сброс HWID', value: `${settings?.hwid_reset_days ?? 30} дн.` },
                  { label: 'Повтор redeem', value: `${settings?.redeem_cooldown_minutes ?? 60} мин.` },
                ].map(row => (
                  <div key={row.label} className="rounded-lg border border-border p-3">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium mt-0.5">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
