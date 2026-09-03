'use client';

import { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';

interface DashboardProps {
  selectedQuery: string;
  selectedApp: string;
}

interface AppData {
  packageName: string;
  title: string;
  score: number;
  ratings: number;
  reviews: number;
  genre: string;
}

interface AppSnapshot {
  packageName: string;
  snapshot: {
    title: string;
    score: number;
    ratings: number;
    reviews: number;
  };
  timestamp: string;
}

interface Review {
  packageName: string;
  title: string;
  body: string;
  rating: number;
  publishedAt: string;
}

export default function Dashboard({ selectedQuery, selectedApp }: DashboardProps) {
  const [apps, setApps] = useState<AppData[]>([]);
  const [snapshots, setSnapshots] = useState<AppSnapshot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedQuery || selectedApp) {
      fetchData();
    } else {
      setApps([]);
      setSnapshots([]);
      setReviews([]);
      setDiscoveries([]);
    }
  }, [selectedQuery, selectedApp]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedQuery) params.append('query', selectedQuery);
      if (selectedApp) params.append('packageName', selectedApp);

      const [appsRes, snapshotsRes, reviewsRes, discoveriesRes] = await Promise.all([
        fetch(`/api/apps?${params}`),
        fetch(`/api/snapshots?${params}`),
        fetch(`/api/reviews?${params.toString()}`),
        fetch(`/api/discoveries?${params}`),
      ]);

      if (!appsRes.ok || !snapshotsRes.ok || !reviewsRes.ok || !discoveriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [appsData, snapshotsData, reviewsData, discoveriesData] = await Promise.all([
        appsRes.json(),
        snapshotsRes.json(),
        reviewsRes.json(),
        discoveriesRes.json(),
      ]);

      setApps(appsData.apps || []);
      setSnapshots(snapshotsData.snapshots || []);
      setReviews(reviewsData.reviews || []);
      setDiscoveries(discoveriesData.discoveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedQuery && !selectedApp) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📋</div>
        <h2>Select a Search Query or App</h2>
        <p>Choose filters on the left to view analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <span className={styles.errorIcon}>⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.filters}>
        {selectedQuery && (
          <span className={styles.filterBadge}>
            🔍 Query: <strong>{selectedQuery}</strong>
          </span>
        )}
        {selectedApp && (
          <span className={styles.filterBadge}>
            📱 App: <strong>{selectedApp}</strong>
          </span>
        )}
      </div>

      {/* Search Query Results */}
      {selectedQuery && (
        <section className={styles.section}>
          <h2>🔍 Apps for "{selectedQuery}"</h2>
          {apps.length > 0 ? (
            <div className={styles.grid}>
              {apps.map((app) => (
                <div key={app.packageName} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3>{app.title}</h3>
                    <span className={styles.genre}>{app.genre}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.metric}>
                      <span className={styles.label}>Rating</span>
                      <span className={styles.value}>{app.score.toFixed(1)} ⭐</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Total Ratings</span>
                      <span className={styles.value}>{(app.ratings / 1000).toFixed(1)}K</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Reviews</span>
                      <span className={styles.value}>{(app.reviews / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                  <small className={styles.packageName}>{app.packageName}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noData}>No apps found for this query</div>
          )}
        </section>
      )}

      {/* App Snapshots */}
      {selectedApp && (
        <section className={styles.section}>
          <h2>📊 Snapshots</h2>
          {snapshots.length > 0 ? (
            <div className={styles.table}>
              <table className={styles.tableElement}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th className={styles.tableHeading}>Timestamp</th>
                    <th className={styles.tableHeading}>Rating</th>
                    <th className={styles.tableHeading}>Ratings Count</th>
                    <th className={styles.tableHeading}>Reviews Count</th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {snapshots.map((snap, idx) => (
                    <tr key={idx} className={styles.tableRow}>
                      <td className={styles.tableData}>{new Date(snap.timestamp).toLocaleString()}</td>
                      <td className={`${styles.tableData} ${styles.rating}`}>{snap.snapshot.score.toFixed(2)}</td>
                      <td className={styles.tableData}>{snap.snapshot.ratings.toLocaleString()}</td>
                      <td className={styles.tableData}>{snap.snapshot.reviews.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.noData}>No snapshots available</div>
          )}
        </section>
      )}

      {/* Recent Reviews */}
      {selectedApp && (
        <section className={styles.section}>
          <h2>💬 Recent Reviews</h2>
          {reviews.length > 0 ? (
            <div className={styles.reviewsList}>
              {reviews.slice(0, 10).map((review, idx) => (
                <div key={idx} className={styles.review}>
                  <div className={styles.reviewHeader}>
                    <span className={styles.rating}>{review.rating} ⭐</span>
                    <span className={styles.date}>
                      {new Date(review.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4>{review.title}</h4>
                  <p>{review.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noData}>No reviews available</div>
          )}
        </section>
      )}

      {/* Discovery History */}
      {selectedQuery && (
        <section className={styles.section}>
          <h2>🔎 Discovery History</h2>
          {discoveries.length > 0 ? (
            <div className={styles.timeline}>
              {discoveries.slice(0, 20).map((discovery, idx) => (
                <div key={idx} className={styles.timelineItem}>
                  <span className={styles.date}>
                    {new Date(discovery.timestamp).toLocaleString()}
                  </span>
                  <span className={styles.query}>{discovery.query}</span>
                  {discovery.appsFound && (
                    <span className={styles.count}>{discovery.appsFound} apps found</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noData}>No discovery history available</div>
          )}
        </section>
      )}
    </div>
  );
}
