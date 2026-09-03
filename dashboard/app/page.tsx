'use client';

import { useState, useEffect } from 'react';
import SearchQueryInput from '@/components/SearchQueryInput';
import AppSelector from '@/components/AppSelector';
import Dashboard from '@/components/Dashboard';
import styles from './page.module.css';

export default function Home() {
  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [appsList, setAppsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available apps on mount
  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/apps');
      if (!response.ok) throw new Error('Failed to fetch apps');
      const data = await response.json();
      setAppsList(data.apps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch apps');
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySelect = (query: string) => {
    setSelectedQuery(query);
  };

  const handleAppSelect = (app: string) => {
    setSelectedApp(app);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📊 Google Play Monitor</h1>
        <p>Real-time app analytics and review monitoring</p>
      </header>

      <main className={styles.main}>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <h2>Filters</h2>
            <SearchQueryInput onSelect={handleQuerySelect} selectedQuery={selectedQuery} />
            <AppSelector
              apps={appsList}
              onSelect={handleAppSelect}
              selectedApp={selectedApp}
              loading={loading}
              error={error}
            />
          </div>
        </div>

        <div className={styles.dashboardContainer}>
          <Dashboard selectedQuery={selectedQuery} selectedApp={selectedApp} />
        </div>
      </main>
    </div>
  );
}
