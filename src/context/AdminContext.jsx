/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { customerService } from '../services/customerService';
import { walletService } from '../services/walletService';
import { schemeService } from '../services/schemeService';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';

const AdminContext = createContext();

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [customers, setCustomers] = useState([]);

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
      if (user?.role === 'admin') refreshCustomers().catch(() => {});
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

  const getAllUsers = () => customers;
  const getUserWallet = (identifier) => customers.find(customer => customer.userId === identifier || customer.phoneNumber === identifier || customer.phone === identifier)?.wallet || { inrBalance: 0, gold24kBalance: 0, silverBalance: 0, transactions: [], activeSchemes: [] };
  async function refreshCustomers() {
    const [data, catalog] = await Promise.all([customerService.listCustomers(), schemeService.listSchemes()]);
    const schemeById = new Map(catalog.map(scheme => [scheme._id, scheme]));
    const hydrated = await Promise.all(data.map(async customer => {
      const [wallet, transactions, activeSchemes] = await Promise.all([
        walletService.getWallet(customer.userId),
        walletService.listTransactions(customer.userId),
        schemeService.getCustomerSchemes(customer.userId),
      ]);
      return { ...customer, phone: customer.phoneNumber?.replace(/^\+91/, ''), wallet: { ...wallet, transactions: transactions.map(transaction => ({ id: transaction.id, date: transaction.createdAt, amount: transaction.amount, assetAdded: transaction.asset, type: transaction.type, desc: transaction.description })), activeSchemes: activeSchemes.map(scheme => { const definition = schemeById.get(scheme.scheme_id); return { id: scheme._id, name: definition?.scheme_name || scheme.scheme_type, schemeType: scheme.scheme_type, goldCarat: scheme.gold_carat, installmentAmount: scheme.installment_amount, totalInstallments: scheme.total_installments, installmentsPaid: scheme.installments_paid || 0, totalPaid: scheme.total_paid_amount || 0, status: scheme.status || 'Active', maturityDate: scheme.maturity_date }; }) } };
    }));
    setCustomers(hydrated);
    return hydrated;
  }

  return (
    <AdminContext.Provider value={{
      admin, loading, login, logout, toasts, showToast,
      changeAdminPin, confirmNewPassword,
      getAllUsers, getUserWallet, refreshCustomers, customers,
    }}>
      {!loading && children}
    </AdminContext.Provider>
  );
};
