/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';

const LivePriceContext = createContext();
const client = generateClient();

const GET_GOLD_RATES = `
  query GetGoldRates {
    getGoldRate {
      authority
      currency
      date
      gold18K
      gold22K
      gold24K
      sourceTimestamp
      unit
      updatedAt
    }
  }
`;

const emptyPrices = {
  gold24k: { price: 0, change: 0, direction: 'flat' },
  gold22k: { price: 0, change: 0, direction: 'flat' },
  silver: { price: 0, change: 0, direction: 'flat' },
};

export const useLivePrice = () => useContext(LivePriceContext);

export const LivePriceProvider = ({ children }) => {
  const [prices, setPrices] = useState(emptyPrices);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshPrices = async () => {
    try {
      const response = await client.graphql({ query: GET_GOLD_RATES, authMode: 'userPool' });
      const latest = response.data?.getGoldRate?.[0];
      if (!latest) throw new Error('No live gold rate available');

      setPrices(prev => ({
        gold24k: { price: latest.gold24K, change: latest.gold24K - prev.gold24k.price, direction: latest.gold24K >= prev.gold24k.price ? 'up' : 'down' },
        gold22k: { price: latest.gold22K, change: latest.gold22K - prev.gold22k.price, direction: latest.gold22K >= prev.gold22k.price ? 'up' : 'down' },
        silver: { price: latest.gold18K, change: latest.gold18K - prev.silver.price, direction: latest.gold18K >= prev.silver.price ? 'up' : 'down' },
      }));
      setLastUpdated(latest.updatedAt || latest.sourceTimestamp || new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err?.errors?.[0]?.message || err.message || 'Unable to load live rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPrices();
    const interval = setInterval(refreshPrices, 86400000);
    return () => clearInterval(interval);
  }, []);

  return (
    <LivePriceContext.Provider value={{ prices, lastUpdated, loading, error, refreshPrices }}>
      {children}
    </LivePriceContext.Provider>
  );
};
