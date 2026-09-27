import { useState, useEffect } from 'react';
import { Download as DownloadIcon, Loader2, CheckCircle, AlertCircle, FileText, Hash, Clock, Shield, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { formatBytes, formatDate } from '../utils/helpers';
import type { Download } from '../types';

export function DownloadPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenLoading, setTokenLoading] = useState<number | null>(null);
  const [downloadToken, setDownloadToken] = useState<{ token: string; expires_at: string; downloadId: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      const response = await api.getDownloads();
      if (response.success && response.data?.downloads) {
        setDownloads(response.data.downloads.filter(d => d.is_active));
      }
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDownloadToken = async (download: Download) => {
    setTokenLoading(download.id);
    setError('');
    try {
      const response = await api.getDownloadToken(download.id);
      if (response.success && response.data?.token) {
        setDownloadToken({
          token: response.data.token,
          expires_at: response.data.expires_at,
          downloadId: download.id,
        });
      } else {
        setError(response.message || 'Ошибка получения токена');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setTokenLoading(null);
    }
  };

  const handleDownload = () => {
    if (!downloadToken) return;
    
    window.location.href = api.getDownloadUrl(downloadToken.token);
    setDownloadToken(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-4" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <DownloadIcon className="w-6 h-6 text-zinc-300" />
          Download
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Скачивание актуальных версий</p>
      </div>

      <div className="max-w-3xl space-y-6">

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {downloadToken && (
        <div className="card p-6 bg-primary/5 border-primary/20 animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Токен скачивания готов</h3>
                <p className="text-sm text-muted-foreground">
                  Ссылка действительна до {formatDate(downloadToken.expires_at)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDownloadToken(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handleDownload}
            className="btn-primary w-full justify-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Скачать сейчас
          </button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Токен работает один раз. Не передавайте его третьим лицам.
          </p>
        </div>
      )}

      {downloads.length === 0 ? (
        <div className="card p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Нет доступных файлов для скачивания</p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map(download => (
            <div key={download.id} className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{download.title}</h3>
                      <p className="text-sm text-muted-foreground">Версия {download.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground sm:ml-16">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {formatBytes(download.filesize)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(download.created_at)}
                    </span>
                  </div>
                  {download.sha256 && (
                    <div className="mt-2 sm:ml-16 flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="w-3 h-3 flex-shrink-0" />
                      <span>SHA-256:</span>
                      <code className="font-mono truncate" title={download.sha256}>
                        {download.sha256}
                      </code>
                    </div>
                  )}
                  {download.changelog && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium mb-1">Changelog:</p>
                      <p className="text-muted-foreground">{download.changelog}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => getDownloadToken(download)}
                  disabled={tokenLoading === download.id}
                  className="btn-primary whitespace-nowrap"
                >
                  {tokenLoading === download.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Скачать
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Безопасность скачивания
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            Каждая ссылка уникальна и работает только один раз
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            Токен привязан к вашему IP и User-Agent
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            Ссылка истекает через 15 минут
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            Прямые ссылки на файлы недоступны
          </li>
        </ul>
      </div>
      </div>
    </div>
  );
}