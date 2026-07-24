/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { customerService } from '../services/customerService';
import { customerPortfolioService } from '../services/customerPortfolioService';
import { schemeService } from '../services/schemeService';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';

const AdminContext = createContext();

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState(null);

  const getAuthenticatedAdmin = async () => {
    const user = await authService.getCurrentUser();
    if (!user) return null;

    const session = await fetchAuthSession();
    const claims = session.tokens?.idToken?.payload || {};
    const groups = Array.isArray(claims['cognito:groups'])
      ? claims['cognito:groups']
      : claims['cognito:groups']
        ? [claims['cognito:groups']]
        : [];

    return {
      ...user,
      groups,
      role: groups.includes('admins') ? 'admin' : 'user',
      loggedInAt: new Date().toISOString(),
    };
  };

  useEffect(() => {
    // Check if user is already logged in
    getAuthenticatedAdmin().then(user => {
      setAdmin(user);
      setLoading(false);
      if (user?.role === 'admin') refreshCustomers().catch(error => {
        console.error('Unable to load customers:', error);
      });
    });
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const login = async (username, password) => {
    try {
      const result = await authService.signInUser(username, password);
      if (result.isSignedIn) {
        const user = await getAuthenticatedAdmin();
        setAdmin(user);
        if (user?.role !== 'admin') {
          await signOut();
          setAdmin(null);
          throw new Error('This account does not have administrator access.');
        }
        await refreshCustomers();
        showToast('Login successful', 'success');
        return { success: true };
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        showToast('Please set a new password', 'info');
        return { success: false, challenge: 'NEW_PASSWORD_REQUIRED' };
      }
      return { success: false };
    } catch (error) {
      console.error("Login error:", error);
      showToast(error.message || 'Invalid credentials', 'error');
      return { success: false, error: error.message };
    }
  };

  const confirmNewPassword = async (newPassword) => {
    try {
      const result = await authService.confirmNewPassword(newPassword);
      if (result.isSignedIn) {
        const user = await getAuthenticatedAdmin();
        setAdmin(user);
        if (user?.role === 'admin') await refreshCustomers();
        showToast('Password updated successfully', 'success');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("New password error:", error);
      showToast(error.message || 'Failed to update password', 'error');
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setAdmin(null);
      setCustomers([]);
      showToast('Logged out', 'info');
    } catch (error) {
      console.error("Logout error:", error);
      showToast('Error logging out', 'error');
    }
  };

  const changeAdminPin = () => {
    showToast('PIN changes are now managed via Email Reset.', 'info');
    return false;
  };

  const addCustomerToList = (customer) => {
    const item = {
      ...customer,
      phone: customer.phoneNumber?.replace(/^\+91/, ''),
      wallet: { inrBalance: 0, gold24kBalance: 0, silverBalance: 0, transactions: [], activeSchemes: [] },
    };
    setCustomers(previous => [item, ...previous.filter(existing => existing.userId !== customer.userId)]);
  };
  async function refreshCustomers() {
    setCustomersLoading(true);
    setCustomersError(null);
    try {
      const [data, definitions] = await Promise.all([
        customerService.listCustomers(),
        schemeService.listSchemes(),
      ]);
      const normalized = await Promise.all(data.map(async customer => ({
        ...customer,
        phone: customer.phoneNumber?.replace(/^\+91/, ''),
        wallet: await customerPortfolioService.load(customer, definitions),
      })));
      setCustomers(normalized);
      return normalized;
    } catch (error) {
      setCustomersError(error?.errors?.[0]?.message || error?.message || 'Unable to load customers.');
      throw error;
    } finally {
      setCustomersLoading(false);
    }
  }

  return (
    <AdminContext.Provider value={{
      admin, loading, login, logout, toasts, showToast,
      changeAdminPin, confirmNewPassword,
      refreshCustomers, customers,
      customersLoading, customersError,
      addCustomerToList,
    }}>
      {!loading && children}
    </AdminContext.Provider>
  );
};
