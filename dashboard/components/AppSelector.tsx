'use client';

import styles from './AppSelector.module.css';

interface AppSelectorProps {
  apps: string[];
  onSelect: (app: string) => void;
  selectedApp: string;
  loading: boolean;
  error: string | null;
}

export default function AppSelector({
  apps,
  onSelect,
  selectedApp,
  loading,
  error,
}: AppSelectorProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label}>Specific App (Optional)</label>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <select
        value={selectedApp}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading || apps.length === 0}
        className={styles.select}
      >
        <option value="">-- All Apps --</option>
        {apps.map((app) => (
          <option key={app} value={app}>
            {app}
          </option>
        ))}
      </select>

      {loading && <span className={styles.loading}>Loading apps...</span>}
      {!loading && apps.length === 0 && (
        <span className={styles.info}>No apps found. Run sync first.</span>
      )}
      {!loading && apps.length > 0 && (
        <span className={styles.info}>{apps.length} apps available</span>
      )}
    </div>
  );
}
