'use client';

import { useState, type ChangeEvent } from 'react';
import { exportCityBackup, MAX_CITY_BACKUP_CHARS, readCityBackup, type CityBackupMeta } from '@/game/core/cityBackup';
import { getWorld, installCityBackup, saveWorld } from '@/game/core/worldStore';

interface CityVaultProps { onClose: () => void; onNewCity: () => void; }
interface PendingBackup { worldJSON: string; meta: CityBackupMeta; name: string; }

export function CityVault({ onClose, onNewCity }: CityVaultProps) {
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadBackup = () => {
    setError('');
    try {
      const world = getWorld();
      const backup = exportCityBackup(world);
      // Keep the normal autosave fresh as well as producing the portable file.
      saveWorld(world);
      const blob = new Blob([backup], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      a.href = url;
      a.download = 'cimulity-city-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      setMessage('Backup downloaded. Keep the JSON file somewhere safe.');
    } catch {
      setError('Could not export this city. Try again or check available storage.');
    }
  };

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setPending(null);
    setError('');
    setMessage('');
    if (!file) return;
    if (file.size > MAX_CITY_BACKUP_CHARS) {
      setError('This file exceeds the 5 MB backup limit.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const result = readCityBackup(text);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setPending({ worldJSON: result.worldJSON, meta: result.meta, name: file.name });
      setMessage('Validated. Your current city has not been changed.');
    } catch {
      setError('The selected file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = () => {
    if (!pending) return;
    const confirmed = window.confirm(
      'Restore "' + pending.name + '"?\n\nThis REPLACES the city currently saved in this browser. Download a backup of your current city first.'
    );
    if (!confirmed) return;
    setError('');
    // installCityBackup performs its own second validation and atomic storage
    // update. Reload immediately so a running simulation cannot overwrite it.
    if (!installCityBackup(pending.worldJSON)) {
      setError('Restore failed. Your current city is unchanged. Check browser storage.');
      return;
    }
    window.location.reload();
  };

  return (
    <div className="city-vault-overlay" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
      <div className="city-vault-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="city-vault-dialog" role="dialog" aria-modal="true" aria-labelledby="city-vault-title" aria-describedby="city-vault-desc">
        <header className="city-vault-heading">
          <div>
            <span className="city-vault-eyebrow">CIMULITY · LOCAL SAVES</span>
            <h2 id="city-vault-title">City Vault <small>城市存档</small></h2>
          </div>
          <button type="button" className="city-vault-close" aria-label="Close City Vault" onClick={onClose}>×</button>
        </header>
        <p id="city-vault-desc" className="city-vault-lead">
          Your city auto-saves in this browser. Export a portable backup before clearing browser data or changing devices.
          <span>本地自动保存。备份文件可转移到另一台设备，无需账号或云端上传。</span>
        </p>
        <div className="city-vault-section">
          <div className="city-vault-step">01 <span>BACK UP CURRENT CITY</span></div>
          <p>Download a complete snapshot of the terrain, finances, buildings, roads and progress.</p>
          <button type="button" className="city-vault-primary" onClick={downloadBackup}>↓ Download city backup / 下载备份</button>
        </div>
        <div className="city-vault-section">
          <div className="city-vault-step">02 <span>RESTORE ANOTHER SAVE</span></div>
          <p>Choose a Cimulity JSON backup. It is validated locally before any existing progress is replaced.</p>
          <label className="city-vault-upload" htmlFor="city-vault-file">{busy ? 'Checking backup…' : '＋ Choose backup file / 选择备份文件'}</label>
          <input id="city-vault-file" type="file" accept=".json,application/json" disabled={busy} onChange={chooseBackup} />
          {pending && (
            <div className="city-vault-preview" aria-live="polite">
              <strong>{pending.name}</strong>
              <span>Saved {new Date(pending.meta.savedAt).toLocaleString()}</span>
              <span>Year {pending.meta.year}, Month {pending.meta.month}, Day {pending.meta.day} · Funds {pending.meta.money.toLocaleString()}</span>
              <button type="button" className="city-vault-danger" onClick={restoreBackup}>Restore this city / 恢复并覆盖</button>
            </div>
          )}
        </div>
        {error && <p className="city-vault-error" role="alert">{error}</p>}
        {message && <p className="city-vault-message" role="status">{message}</p>}
        <footer className="city-vault-footer"><span>No account · No uploads · Validated saves only · Local browser storage</span><button type="button" className="city-vault-new" onClick={() => { onNewCity(); onClose(); }}>New city / 新建城市</button></footer>
      </section>
    </div>
  );
}
