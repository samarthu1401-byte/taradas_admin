import { Sparkles } from 'lucide-react';

export default function PageLead({ eyebrow = 'Taradas workspace', title, description, children }) {
  return (
    <div className="page-lead">
      <div>
        <span className="page-lead-eyebrow"><span className="page-lead-icon"><Sparkles size={13} /></span> {eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-lead-actions">{children}</div>}
    </div>
  );
}
