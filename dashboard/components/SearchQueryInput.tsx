'use client';

import { useState, useEffect } from 'react';
import styles from './SearchQueryInput.module.css';

interface SearchQueryInputProps {
  onSelect: (query: string) => void;
  selectedQuery: string;
}

export default function SearchQueryInput({ onSelect, selectedQuery }: SearchQueryInputProps) {
  const [queries, setQueries] = useState<string[]>([]);
  const [filteredQueries, setFilteredQueries] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueries();
  }, []);

  useEffect(() => {
    setInputValue(selectedQuery);
  }, [selectedQuery]);

  const fetchQueries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/search-queries');
      if (!response.ok) throw new Error('Failed to fetch queries');
      const data = await response.json();
      setQueries(data.queries || []);
      setFilteredQueries(data.queries || []);
    } catch (error) {
      console.error('Failed to fetch search queries:', error);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim()) {
      const filtered = queries.filter((q) =>
        q.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredQueries(filtered);
    } else {
      setFilteredQueries(queries);
    }
  };

  const handleSelect = (query: string) => {
    setInputValue(query);
    onSelect(query);
    setFilteredQueries(queries);
  };

  return (
    <div className={styles.container}>
      <label className={styles.label}>Search Query</label>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          placeholder="Type to search queries..."
          value={inputValue}
          onChange={handleInputChange}
          className={styles.input}
          disabled={loading}
        />
        {loading && <span className={styles.loader}>Loading...</span>}
      </div>

      {inputValue && filteredQueries.length > 0 && (
        <div className={styles.suggestions}>
          {filteredQueries.slice(0, 8).map((query) => (
            <button
              key={query}
              className={`${styles.suggestion} ${
                selectedQuery === query ? styles.active : ''
              }`}
              onClick={() => handleSelect(query)}
            >
              {query}
            </button>
          ))}
        </div>
      )}

      {inputValue && filteredQueries.length === 0 && (
        <div className={styles.noResults}>No matching queries found</div>
      )}

      {!inputValue && queries.length > 0 && (
        <div className={styles.suggestions}>
          {queries.slice(0, 8).map((query) => (
            <button
              key={query}
              className={styles.suggestion}
              onClick={() => handleSelect(query)}
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
