/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/api';

const LivePriceContext = createContext();
const getClient = () => generateClient();

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

const SET_GOLD_RATE = `
  mutation SetGoldRate($input: SetGoldRateInput!) {
    setGoldRate(input: $input) {
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
  gold18k: { price: 0, change: 0, direction: 'flat' },
};

export const useLivePrice = () => useContext(LivePriceContext);

export const LivePriceProvider = ({ children }) => {
  const [prices, setPrices] = useState(emptyPrices);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [authority, setAuthority] = useState('Auto Market Rate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialFetchStarted = useRef(false);

  const refreshPrices = async () => {
    try {
      const response = await getClient().graphql({ query: GET_GOLD_RATES, authMode: 'userPool' });
      const latest = response.data?.getGoldRate?.[0];
      if (!latest) throw new Error('No live gold rate available');

      setPrices(prev => ({
        gold24k: { price: latest.gold24K, change: latest.gold24K - prev.gold24k.price, direction: latest.gold24K >= prev.gold24k.price ? 'up' : 'down' },
        gold22k: { price: latest.gold22K, change: latest.gold22K - prev.gold22k.price, direction: latest.gold22K >= prev.gold22k.price ? 'up' : 'down' },
        gold18k: { price: latest.gold18K, change: latest.gold18K - prev.gold18k.price, direction: latest.gold18K >= prev.gold18k.price ? 'up' : 'down' },
      }));
      setAuthority(latest.authority || 'Auto Market Rate');
      setLastUpdated(latest.updatedAt || latest.sourceTimestamp || new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err?.errors?.[0]?.message || err.message || 'Unable to load live rates');
    } finally {
      setLoading(false);
    }
  };

  const updateRate = async (gold24K, gold22K, gold18K) => {
    try {
      setLoading(true);
      const input = {
        gold24K: parseFloat(gold24K),
        gold22K: parseFloat(gold22K || (parseFloat(gold24K) * 22 / 24).toFixed(2)),
        gold18K: parseFloat(gold18K || (parseFloat(gold24K) * 18 / 24).toFixed(2)),
      };
      await getClient().graphql({
        query: SET_GOLD_RATE,
        variables: { input },
        authMode: 'userPool'
      });
      await refreshPrices();
      return true;
    } catch (err) {
      setError(err?.errors?.[0]?.message || err.message || 'Failed to update gold rate');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFetchStarted.current) return undefined;
    initialFetchStarted.current = true;
    refreshPrices();
    const interval = setInterval(refreshPrices, 86400000);
    return () => clearInterval(interval);
  }, []);

  return (
    <LivePriceContext.Provider value={{ prices, lastUpdated, authority, loading, error, refreshPrices, updateRate }}>
      {children}
    </LivePriceContext.Provider>
  );
};
