import { useAdmin } from '../context/AdminContext';

export default function ToastContainer() {
  const { toasts } = useAdmin();

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
