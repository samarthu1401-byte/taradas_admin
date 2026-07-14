import { Database, ShieldCheck } from 'lucide-react';

export default function DataBackup() {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="d-flex align-center gap-2"><Database className="text-gold" /> Server Data Protection</h3>
      </div>
      <div className="alert alert-success"><ShieldCheck size={18} /> Data is maintained in the secured backend database. Browser storage is not used.</div>
      <p className="text-muted">Database backups and restore operations are managed through AWS infrastructure and are not performed from the browser.</p>
    </div>
  );
}
