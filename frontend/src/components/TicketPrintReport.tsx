import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import { resolveAttachmentUrl as resolveUrl } from '../utils/resolveAttachmentUrl';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: any) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const fmtDateTime = (v: any) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// ── lookup maps ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { en: string; color: string }> = {
  SUBMITTED:              { en: 'Submitted',            color: '#2563eb' },
  ASSIGNED:               { en: 'Assigned',             color: '#d97706' },
  UNDER_REVIEW:           { en: 'Under Review',         color: '#7c3aed' },
  UNDER_INVESTIGATION:    { en: 'Under Investigation',  color: '#4f46e5' },
  PENDING_REMINDER:       { en: 'Pending Reminder',     color: '#ea580c' },
  ESCALATED:              { en: 'Escalated',            color: '#dc2626' },
  CLOSED:                 { en: 'Closed',               color: '#059669' },
  RETURNED_TO_REPORTER:   { en: 'Returned to Reporter', color: '#be185d' },
  RETURNED_TO_DEPARTMENT: { en: 'Returned to Dept.',    color: '#9d174d' },
};
const TYPE_LABELS: Record<string, { en: string }> = {
  ACCIDENT:    { en: 'Accident' },
  NEAR_MISS:   { en: 'Near Miss' },
  OBSERVATION: { en: 'Observation' },
  HAZARD:      { en: 'Hazard' },
  SPILL:       { en: 'Environmental Spill' }
};
const SEVERITY_LEVELS: Record<string, { en: string; color: string }> = {
  LOW:      { en: 'Low',      color: '#22c55e' },
  MINOR:    { en: 'Minor',    color: '#10b981' },
  MODERATE: { en: 'Moderate', color: '#f59e0b' },
  MAJOR:    { en: 'Major',    color: '#ef4444' },
  SEVERE:   { en: 'Severe',   color: '#b91c1c' },
};
const PLAN_LABELS: Record<string, { en: string }> = {
  IMMEDIATE:  { en: 'Immediate Plan' },
  SHORT_TERM: { en: 'Short Term Plan' },
  LONG_TERM:  { en: 'Long Term Plan' }
};

// ── sub-components ─────────────────────────────────────────────────────────
const SecHead = ({ en, color }: { en: string; color: string }) => (
  <div style={{
    background: color, color: '#fff', padding: '8px 16px',
    borderRadius: 8, fontWeight: 800, fontSize: '11pt', marginBottom: 12,
    display: 'flex', justifyContent: 'space-between'
  }}>
    <span>{en}</span>
  </div>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: '9.5pt' }}>
    <div style={{ width: 180, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{label}</div>
    <div style={{ flex: 1, color: '#1e3a5f', fontWeight: 600 }}>{value}</div>
  </div>
);

const AttachmentGrid = ({ attachments, title, imageMap }: any) => {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div>
      {title && <div style={{ fontSize: '10pt', fontWeight: 800, color: '#1e3a5f', marginBottom: 8 }}>{title}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {attachments.map((a: any, i: number) => {
          const isImg = a.type?.startsWith('image/') || a.name?.match(/\.(jpeg|jpg|gif|png|webp)$/i) || a.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i);
          const dataUrl = imageMap?.[a.id];
          return (
            <div key={i} style={{ width: 140, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
              {isImg ? (
                dataUrl ? (
                  <img src={dataUrl} alt="attachment" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', fontSize: '8pt', color: '#94a3b8' }}>Loading...</div>
                )
              ) : (
                <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontSize: '24pt' }}>📄</div>
              )}
              <div style={{ padding: '6px', fontSize: '7.5pt', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {a.name || a.filename || a.url.split('/').pop()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Fetch any URL with optional Bearer token, return data URL (base64) or null on failure
const fetchAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const isImageAttachment = (a: any): boolean =>
  a?.type?.startsWith('image/') ||
  /\.(jpeg|jpg|gif|png|webp)$/i.test(a?.name || '') ||
  /\.(jpeg|jpg|gif|png|webp)$/i.test(a?.url  || '');

// ── main ───────────────────────────────────────────────────────────────────
const TicketPrintReport = ({ ticket, onClose }: { ticket: any; onClose: () => void }) => {
  const [imageMap,  setImageMap]  = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ready,     setReady]     = useState(false);

  // Lock body scroll while the print overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Parallel preload of all attachment images + QR code as base64 data URLs.
  // Sets `ready=true` only after EVERY asset is settled (success or failure),
  // so the print effect below can safely fire afterwards.
  useEffect(() => {
    let cancelled = false;

    const allAtts = [
      ...(ticket.attachments || []),
      ...(ticket.actionPlans?.flatMap((p: any) => p.attachments || []) || []),
    ].filter(isImageAttachment);

    const imagePromises = allAtts.map(async (a) => {
      const data = await fetchAsBase64(resolveUrl(a.url));
      return [a.id, data] as const;
    });

    const qrPromise = fetchAsBase64(resolveUrl(`/api/tickets/${ticket.id}/qrcode`));

    Promise.all([Promise.all(imagePromises), qrPromise]).then(([imgs, qr]) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      imgs.forEach(([id, data]) => { if (data) map[id] = data; });
      setImageMap(map);
      if (qr) setQrDataUrl(qr);
      setReady(true);
    });

    return () => { cancelled = true; };
  }, [ticket]);

  // Auto-fire print only after all assets are embedded (200ms grace for paint commit)
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => window.print(), 200);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ticket) return null;

  const oc = ticket.offCircuitReport || ticket.ocTicket || {};
  let injuredPersons = [];
  try {
    injuredPersons = typeof oc.injuredPersons === 'string' ? JSON.parse(oc.injuredPersons) : (oc.injuredPersons || []);
  } catch (e) {
    injuredPersons = [];
  }
  const actionPlans = ticket.actionPlans || [];
  const activityLogs = ticket.activityLogs || [];
  const attachments = ticket.attachments || [];
  const typeInfo = TYPE_LABELS[ticket.type] || { en: ticket.type };
  const sevInfo = SEVERITY_LEVELS[ticket.severityLevel || oc.severity] || { en: ticket.severityLevel || oc.severity || 'N/A', color: '#64748b' };

  const report = (
    <div className="ticket-print-view" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#fff', zIndex: 999999, overflowY: 'auto',
      direction: 'ltr', textAlign: 'left', fontFamily: '"Inter", "Segoe UI", sans-serif'
    }}>
      <style>{`
        @media print {
          body > :not(.ticket-print-view) { display: none !important; }
          .ticket-print-view {
            position: relative !important;
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            background: transparent !important;
          }
          @page { size: A4 portrait; margin: 12mm; }
          .print-content { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Floating buttons */}
      <div className="no-print" style={{
        position: 'fixed', top: 20, right: 20, display: 'flex', gap: 10, zIndex: 10
      }}>
        <button onClick={() => window.print()} style={{
          background: '#0f4c81', color: '#fff', padding: '10px 20px', borderRadius: 8,
          border: 'none', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          Print / PDF
        </button>
        <button onClick={onClose} style={{
          background: '#ef4444', color: '#fff', padding: '10px 20px', borderRadius: 8,
          border: 'none', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          Close
        </button>
      </div>

      {/* A4 Container */}
      <div className="print-content" style={{
        maxWidth: '210mm', margin: '40px auto', background: '#fff',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
        padding: '30px 40px', color: '#1e293b'
      }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0f4c81', paddingBottom: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24pt', color: '#0f4c81', fontWeight: 900 }}>Incident Report</h1>
            <div style={{ color: '#64748b', fontSize: '10pt', marginTop: 4 }}>SMC HSE Platform</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9pt', color: '#94a3b8', marginBottom: 4 }}>
              Printed: {new Date().toLocaleDateString('en-GB')}
            </div>
            {STATUS_LABELS[ticket.status] && (
              <div style={{ background: STATUS_LABELS[ticket.status].color, color: '#fff', padding: '4px 16px', borderRadius: 99, fontSize: '10pt', fontWeight: 800, display: 'inline-block' }}>
                {STATUS_LABELS[ticket.status].en}
              </div>
            )}
          </div>
        </div>

        {/* META BAR */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: 2 }}>Ticket No.</div>
            <div style={{ fontWeight: 900, color: '#0f4c81', fontSize: '12pt' }}>{ticket.ticketNo}</div>
          </div>
          <div>
            <div style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: 2 }}>Type</div>
            <div style={{ fontWeight: 800, color: '#334155' }}>{typeInfo.en}</div>
          </div>
          <div>
            <div style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: 2 }}>Created</div>
            <div style={{ fontWeight: 600 }}>{fmtDateTime(ticket.createdAt)}</div>
          </div>
          {ticket.closedAt && (
            <div>
              <div style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: 2 }}>Closed</div>
              <div style={{ fontWeight: 600 }}>{fmtDateTime(ticket.closedAt)}</div>
            </div>
          )}
          
          {/* LOCATION BLOCK - FIXED NO COORDS */}
          {(ticket.zone?.name || ticket.location) && (() => {
            // Helper: check if it's purely coordinates
            const isCoords = (s: string) => Boolean(s && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s.trim()));
            const zoneName = ticket.zone?.name || '';
            const locText  = ticket.location && !isCoords(ticket.location) ? ticket.location : '';
            const display  = zoneName
              ? (locText && locText !== zoneName ? zoneName + ' - ' + locText : zoneName)
              : locText;
            
            if (!display) return null;
            return (
              <div style={{ gridColumn: '1 / -1', marginTop: 8, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: 2 }}>Location</div>
                <div style={{ fontWeight: 700, color: '#1e3a5f' }}>{display}</div>
              </div>
            );
          })()}
        </div>

        {/* INCIDENT DETAILS */}
        <div style={{ marginBottom: 18 }}>
          <SecHead en="Incident Details" color="#1e3a5f" />
          <Row label="Incident Date" value={`${fmt(oc.incidentDate)}  ${oc.incidentTime || ''}`} />
          <Row label="Reported By" value={ticket.reporter?.name || oc.reporterName || 'N/A'} />
          <Row label="Description" value={<span style={{ whiteSpace: 'pre-wrap' }}>{oc.whatHappened || ticket.description}</span>} />
          {oc.isLateReport && <Row label="Late Report Reason" value={oc.lateReportReason} />}
        </div>

        {/* CONTROLLER NOTES */}
        {oc.controllerNotes && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Controller Notes" color="#1d4ed8" />
            <div style={{ padding: '4px 0 2px', fontSize: '9pt', color: '#64748b' }}>
              <strong>By:</strong> {oc.controllerFilledBy || 'N/A'} &nbsp;·&nbsp; {fmtDateTime(oc.controllerFilledAt)}
            </div>
            <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '10pt', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {oc.controllerNotes}
            </div>
          </div>
        )}

        {/* CLASSIFICATION */}
        {sevInfo && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Classification — التصنيف" color="#374151" />
            <div style={{ padding: '10px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: sevInfo.color, color: '#fff', padding: '5px 18px', borderRadius: 99, fontWeight: 800, fontSize: '11pt' }}>
                {sevInfo.en}
              </span>
            </div>
            {(() => {
              const raw = oc.hazardCategory;
              if (!raw) return null;
              let cats: string[] = [];
              try { cats = JSON.parse(raw); } catch { cats = [raw]; }
              if (!cats.length) return null;
              const HAZARD_SVG: Record<string, {svg: React.ReactNode, label: string, labelAr: string}> = {
                'Biological Hazards': { label: 'Biological', labelAr: 'بيولوجية', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="8" fill="#1a1a1a"/><path d="M32 24 C32 16 20 10 14 18 C8 26 16 34 24 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/><path d="M32 24 C38 16 50 18 48 28 C46 38 36 36 32 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/><path d="M26 34 C18 38 16 50 26 50 C36 50 36 40 32 38" stroke="#1a1a1a" strokeWidth="5" fill="none"/></svg> },
                'Chemical Hazards': { label: 'Chemical', labelAr: 'كيميائية', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="6" fill="#1a1a1a"/><circle cx="20" cy="20" r="4" fill="#1a1a1a"/><circle cx="44" cy="20" r="4" fill="#1a1a1a"/><line x1="15" y1="50" x2="27" y2="30" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><line x1="37" y1="30" x2="49" y2="50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><line x1="10" y1="54" x2="54" y2="54" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/></svg> },
                'Physical Hazards': { label: 'Physical', labelAr: 'فيزيائية', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="32" cy="32" r="6" fill="#1a1a1a"/><path d="M32 8 L32 18 M32 46 L32 56 M8 32 L18 32 M46 32 L56 32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/><path d="M32 14 A18 18 0 0 1 50 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/><path d="M32 50 A18 18 0 0 1 14 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/></svg> },
                'Safety Hazards': { label: 'Safety', labelAr: 'السلامة', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="40" cy="14" r="5" fill="#1a1a1a"/><path d="M40 20 L38 30 L30 26 L20 40" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M30 26 L26 42 L36 48" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M14 44 L22 44" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/></svg> },
                'Ergonomic Hazards': { label: 'Ergonomic', labelAr: 'هندسة بشرية', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><circle cx="36" cy="13" r="5" fill="#1a1a1a"/><path d="M36 18 L34 28 L44 32 L42 22" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="#1a1a1a" fillOpacity="0.3"/><path d="M34 28 L32 42 L26 52" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><path d="M32 42 L40 50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><path d="M20 36 L34 28" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/><rect x="14" y="32" width="12" height="8" rx="2" fill="#1a1a1a"/></svg> },
                'Psychosocial Hazards': { label: 'Psychosocial', labelAr: 'نفسية-اجتماعية', svg: <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FFC107"/><ellipse cx="32" cy="30" rx="16" ry="18" fill="#1a1a1a"/><path d="M20 22 C20 14 44 14 44 22" fill="#1a1a1a"/><path d="M24 26 C24 22 28 20 32 22 C36 20 40 22 40 26" stroke="#FFC107" strokeWidth="1.5" fill="none"/><path d="M26 32 C26 30 28 28 30 30" stroke="#FFC107" strokeWidth="1.5" fill="none"/><path d="M34 30 C36 28 38 30 38 32" stroke="#FFC107" strokeWidth="1.5" fill="none"/></svg> },
              };
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '9pt', fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Hazard Categories — تصنيف المخاطر</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {cats.map((c: string) => {
                      const h = HAZARD_SVG[c];
                      return (
                        <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: '#fffbeb', border: '2px solid #fbbf24', borderRadius: 12, padding: '8px 10px', minWidth: 72 }}>
                          {h?.svg}
                          <span style={{ fontSize: '7pt', fontWeight: 800, color: '#92400e', textAlign: 'center', lineHeight: 1.2 }}>{h?.label || c}</span>
                          <span style={{ fontSize: '6pt', fontWeight: 700, color: '#b45309', direction: 'rtl' }}>{h?.labelAr || ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TICKET ATTACHMENTS */}
        {attachments.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Report Attachments" color="#0369a1" />
            <AttachmentGrid attachments={attachments} imageMap={imageMap} />
          </div>
        )}

        {/* INJURIES */}
        {injuredPersons.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Injured Persons" color="#b91c1c" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  {['Name', 'Type', 'Company / Dept', 'Mobile', 'Employee ID', 'GOSI Report No.'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', border: '1px solid #fecaca', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {injuredPersons.map((p: any, i: number) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fff7f7' }}>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca' }}>{p.name || 'N/A'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca' }}>{p.type || 'N/A'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca' }}>{p.company || p.dept || 'N/A'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca' }}>{p.mobile || 'N/A'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca' }}>{p.gosiEmployeeId || 'N/A'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid #fecaca', fontWeight: p.gosiReportNumber ? 700 : 400, color: p.gosiReportNumber ? '#1e3a5f' : '#94a3b8' }}>
                      {p.gosiReportNumber || (p.gosiSubmitted === false ? `Not reported (${p.gosiNoReason || 'No reason'})` : 'N/A')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DEPARTMENT RESPONSE */}
        {oc.depRepFilledBy && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Department Representative Response" color="#4c1d95" />
            <Row label="Filled By" value={oc.depRepFilledBy} />
            <Row label="Filled At" value={fmtDateTime(oc.depRepFilledAt)} />
          </div>
        )}

        {/* HR RESPONSE */}
        {oc.hrFilledBy && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="HR Response (GOSI)" color="#0f766e" />
            <Row label="Submitted By" value={oc.hrFilledBy} />
            <Row label="Submitted At" value={fmtDateTime(oc.hrFilledAt)} />
          </div>
        )}

        {/* GOSI & CONTRACTOR */}
        {(injuredPersons.length > 0 || (oc.contractorNotified !== null && oc.contractorNotified !== undefined)) && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="GOSI & Contractor Details" color="#4c1d95" />

            {/* Employee GOSI per-person */}
            {(() => {
              const empInjured = injuredPersons.filter((p: any) => (p.type === 'EMPLOYEE' || p.affiliate === 'Employee'));
              if (empInjured.length > 0) return (<>
                <div style={{ padding: '8px 0 4px', fontWeight: 800, fontSize: '10pt', color: '#4c1d95', borderBottom: '1px solid #e2e8f0' }}>
                  GOSI Report per Injured Employee ({empInjured.length})
                </div>
                {empInjured.map((p: any, i: number) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 2 }}>{i + 1}. {p.name || `Employee #${i + 1}`}</div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '9pt', color: '#64748b', marginBottom: 6 }}>
                      {p.mobile && <span>Ph: {p.mobile}</span>}
                      {p.dept && <span>Dept: {p.dept}</span>}
                    </div>
                    {p.gosiEmployeeId ? (<>
                      <Row label="Employee ID" value={p.gosiEmployeeId} />
                      <Row label="GOSI Informed?" value={p.gosiSubmitted ? 'Yes' : 'No'} />
                      {p.gosiSubmitted ? (<>
                        <Row label="GOSI Report Date" value={fmt(p.gosiReportDate)} />
                        <Row label="GOSI Report No." value={p.gosiReportNumber} />
                      </>) : (
                        <Row label="Reason (No GOSI)" value={p.gosiNoReason} />
                      )}
                    </>) : (
                      <div style={{ color: '#d97706', fontSize: '9pt', fontStyle: 'italic' }}>GOSI data not entered yet</div>
                    )}
                  </div>
                ))}
              </>);
              if (oc.gosiSubmitted !== null && oc.gosiSubmitted !== undefined) return (<>
                <Row label="GOSI Informed?" value={oc.gosiSubmitted ? 'Yes' : 'No'} />
                {oc.gosiSubmitted ? (<>
                  <Row label="Employee ID" value={oc.gosiEmployeeId} />
                  <Row label="GOSI Report Date" value={fmt(oc.gosiReportDate)} />
                  <Row label="GOSI Report No." value={oc.gosiReportNumber} />
                </>) : <Row label="Reason (No GOSI)" value={oc.gosiNoReason} />}
              </>);
              return null;
            })()}

            {/* Contractors */}
            {(() => {
              const contractors = injuredPersons.filter((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor');
              if (!contractors.length) return null;
              return (<>
                <div style={{ padding: '8px 0 4px', fontWeight: 800, fontSize: '10pt', color: '#6d28d9', borderBottom: '1px solid #e2e8f0', marginTop: 10 }}>
                  Injured Contractors ({contractors.length})
                </div>
                {contractors.map((p: any, i: number) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700, color: '#4c1d95', marginBottom: 2 }}>{i + 1}. {p.name || `Contractor #${i + 1}`}</div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '9pt', color: '#64748b' }}>
                      {p.mobile && <span>Ph: {p.mobile}</span>}
                      {p.company && <span>Company: {p.company}</span>}
                    </div>
                  </div>
                ))}
                <div style={{ padding: '8px 0 4px', fontWeight: 700, fontSize: '9.5pt', color: '#4c1d95', marginTop: 6 }}>Company Notification</div>
                {oc.contractorNotified !== null && oc.contractorNotified !== undefined ? (<>
                  <Row label="Company Notified?" value={oc.contractorNotified ? 'Yes' : 'No'} />
                  {oc.contractorNotified
                    ? <Row label="Notification Date" value={fmt(oc.contractorNotifyDate)} />
                    : <Row label="Reason" value={oc.contractorNoReason} />}
                </>) : (
                  <div style={{ color: '#d97706', fontSize: '9pt', fontStyle: 'italic', paddingTop: 4 }}>Pending dept rep confirmation</div>
                )}
              </>);
            })()}

            {/* Contractor-only (no persons) */}
            {injuredPersons.filter((p: any) => p.type === 'CONTRACTOR' || p.affiliate === 'Contractor').length === 0 &&
             oc.contractorNotified !== null && oc.contractorNotified !== undefined && (<>
              <div style={{ padding: '8px 0 4px', fontWeight: 800, fontSize: '10pt', color: '#4c1d95', borderBottom: '1px solid #e2e8f0', marginTop: 8 }}>Contractor Data</div>
              <Row label="Contractor Notified?" value={oc.contractorNotified ? 'Yes' : 'No'} />
              {oc.contractorNotified
                ? <Row label="Notification Date" value={fmt(oc.contractorNotifyDate)} />
                : <Row label="Reason" value={oc.contractorNoReason} />}
            </>)}

            {/* Other injured */}
            {(() => {
              const others = injuredPersons.filter((p: any) => p.type === 'OTHER');
              if (!others.length) return null;
              return (<>
                <div style={{ padding: '8px 0 4px', fontWeight: 800, fontSize: '10pt', color: '#374151', borderBottom: '1px solid #e2e8f0', marginTop: 8 }}>Other Injured ({others.length})</div>
                {others.map((p: any, i: number) => (
                  <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700, color: '#374151' }}>{i + 1}. {p.name || `Person #${i + 1}`}</div>
                    {p.mobile && <div style={{ fontSize: '9pt', color: '#64748b' }}>Ph: {p.mobile}</div>}
                  </div>
                ))}
              </>);
            })()}
          </div>
        )}

        {/* ACTION PLANS */}
        {actionPlans.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Action Plans" color="#0f4c81" />
            {(['IMMEDIATE', 'SHORT_TERM', 'LONG_TERM'] as const).map(type => {
              const plan = actionPlans.find(p => p.type === type);
              if (!plan) return (
                <div key={type} style={{ padding: '7px 12px', marginBottom: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '9pt' }}>
                  {PLAN_LABELS[type].en}: Not added yet
                </div>
              );
              const sc = plan.status === 'APPROVED' ? '#059669' : plan.status === 'REJECTED' ? '#dc2626' : '#2563eb';
              return (
                <div key={type} style={{ marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '10.5pt' }}>{PLAN_LABELS[type].en}</span>
                    <span style={{ background: sc, color: '#fff', padding: '3px 12px', borderRadius: 99, fontSize: '8pt', fontWeight: 700 }}>
                      {plan.status === 'APPROVED' ? 'Approved' : plan.status === 'REJECTED' ? 'Rejected' : 'Saved'}
                    </span>
                  </div>
                  {plan.submittedBy && <div style={{ padding: '4px 12px 0', fontSize: '8.5pt', color: '#64748b' }}>By: <strong>{plan.submittedBy?.name || plan.submittedBy}</strong></div>}
                  <div style={{ padding: '10px 12px', fontSize: '10pt', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{plan.description}</div>
                  {plan.targetDate && (
                    <div style={{ padding: '4px 12px 8px', fontSize: '9pt', color: '#2563eb', fontWeight: 600 }}>
                      Target Date: {fmt(plan.targetDate)}
                    </div>
                  )}
                  {plan.reviewNotes && (
                    <div style={{ padding: '7px 12px', background: plan.status === 'APPROVED' ? '#ecfdf5' : '#fef2f2', fontSize: '9pt', borderTop: '1px solid #e2e8f0' }}>
                      <strong>Reviewer Note: </strong>{plan.reviewNotes}
                    </div>
                  )}
                  {plan.attachments?.length > 0 && (
                    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #f1f5f9' }}>
                      <AttachmentGrid attachments={plan.attachments} title="Plan Attachments" imageMap={imageMap} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* RCA */}
        {oc.rcaRequired && oc.rcaCompleted && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Root Cause Analysis — تحليل السبب الجذري" color="#1f2937" />
            {[
              { num: 1, en: 'What are the Immediate Causes?', ar: 'ماهي الأسباب المباشرة للحدث/الحادث ؟', value: oc.rcaCause, color: '#dc2626' },
              { num: 2, en: 'What are the Underlying Causes?', ar: 'ماهي الأسباب الغير مباشرة للحدث/الحادث ؟', value: oc.rcaWhy, color: '#ea580c' },
              { num: 3, en: 'What are the Root Causes?', ar: 'ماهي الأسباب الجذرية للحدث/الحادث ؟', value: oc.rcaRootCause, color: '#d97706' },
              { num: 4, en: 'Immediate and Corrective Actions', ar: 'الإجراءات الفورية والتصحيحية', value: oc.rcaCategory, color: '#2563eb' },
              { num: 5, en: 'Preventive Actions', ar: 'الإجراءات الوقائية التي تمنع تكرار الحادث', value: oc.rcaPreventiveActions, color: '#059669' },
            ].map(q => (
              <div key={q.num} style={{ marginBottom: 14, borderLeft: `4px solid ${q.color}`, paddingLeft: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: q.color, color: '#fff', width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 900 }}>{q.num}</span>
                  <span style={{ fontWeight: 800, fontSize: '10pt', color: '#1e293b' }}>{q.en}</span>
                </div>
                <div style={{ fontSize: '9pt', color: '#64748b', fontWeight: 700, marginBottom: 4, direction: 'rtl', textAlign: 'right' }}>{q.ar}</div>
                <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '10pt', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#1e293b' }}>
                  {q.value || 'N/A'}
                </div>
              </div>
            ))}
            {oc.rcaFilledBy && (
              <div style={{ fontSize: '8.5pt', color: '#94a3b8', marginTop: 6 }}>
                Completed by: <strong>{oc.rcaFilledBy}</strong> — {fmtDateTime(oc.rcaFilledAt)}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY LOG */}
        {activityLogs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Activity Log" color="#374151" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Date / Time', 'User', 'Action', 'Details'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log: any, i: number) => (
                  <tr key={log.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '8pt' }}>{fmtDateTime(log.createdAt)}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>{log.actor?.name || 'N/A'}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>{log.action}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', color: '#64748b' }}>{log.details || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CLOSURE */}
        {ticket.closureReason && (
          <div style={{ marginBottom: 18 }}>
            <SecHead en="Closure Reason" color="#065f46" />
            <div style={{ padding: '8px 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.closureReason}</div>
          </div>
        )}

        {/* AUTHORIZATION SEAL */}
        <div style={{ marginTop: 32, border: '2px solid #1e3a5f', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12pt', fontWeight: 900, color: '#1e3a5f', marginBottom: 4 }}>Authorized by SMC HSE Department</div>
            <div style={{ display: 'flex', gap: 16, fontSize: '9pt', color: '#64748b' }}>
              <span>Ticket No.: <strong style={{ color: '#1e3a5f' }}>{ticket.ticketNo}</strong></span>
              <span>Date: <strong style={{ color: '#1e3a5f' }}>{fmt(ticket.createdAt)}</strong></span>
              {sevInfo && <span>Severity: <strong style={{ color: sevInfo.color }}>{sevInfo.en}</strong></span>}
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 40 }}>
              <div style={{ fontSize: '9pt', color: '#94a3b8' }}>
                <div>Officer Signature</div>
                <div style={{ marginTop: 24, borderBottom: '1px solid #94a3b8', width: 160 }} />
              </div>
              <div style={{ fontSize: '9pt', color: '#94a3b8' }}>
                <div>Date</div>
                <div style={{ marginTop: 24, borderBottom: '1px solid #94a3b8', width: 120 }} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginLeft: 16 }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ width: 110, height: 110, display: 'block', margin: '0 auto' }} />
            ) : (
              <div style={{ width: 110, height: 110, background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', color: '#94a3b8' }}>QR Code</div>
            )}
            <div style={{ fontSize: '7pt', color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>Scan to verify</div>
          </div>
        </div>

        {/* PAGE FOOTER */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8' }}>
          <span>SMC Incident Management System — HSE Platform</span>
          <span>Auto-generated report</span>
          <span>{new Date().toLocaleString('en-GB')}</span>
        </div>

      </div>
    </div>
  );

  return createPortal(report, document.body);
};

export default TicketPrintReport;
