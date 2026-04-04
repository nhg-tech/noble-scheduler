import { useEffect, useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';
import { apiSchedules } from '../../api';

function formatStamp(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VersionHistoryModal({
  scheduleId,
  scheduleName,
  onClose,
  onRestored,
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const entries = await apiSchedules.getHistory(scheduleId);
        if (!cancelled) setHistory(Array.isArray(entries) ? entries : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load version history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (scheduleId) load();
    return () => { cancelled = true; };
  }, [scheduleId]);

  async function handleRestore(entry) {
    if (entry.isCurrentVersion) return;
    setRestoringId(entry.id);
    setError('');
    try {
      const restored = await apiSchedules.restore(entry.id);
      await onRestored?.(restored);
    } catch (err) {
      setError(err.message || 'Failed to restore this version.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Modal title={`Version History${scheduleName ? ` · ${scheduleName}` : ''}`} onClose={onClose} width={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.5 }}>
          Published schedules now keep revision snapshots. Restoring a prior version creates a new current version so the original history stays intact.
        </div>

        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: '#FDECEC',
            color: '#7F1D1D',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--gray)', padding: '12px 0' }}>Loading versions…</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--gray)', padding: '12px 0' }}>No published history yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid var(--gray-light)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: entry.isCurrentVersion ? 'var(--purple-pale)' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>
                        Version {entry.versionNumber}
                      </span>
                      {entry.isCurrentVersion && (
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: 'var(--gold-light)',
                          color: 'var(--gold-dark)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gray)' }}>
                      Published {formatStamp(entry.publishedAt || entry.updatedAt)}
                    </div>
                    {entry.changeNote && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--dark)', lineHeight: 1.45 }}>
                        {entry.changeNote}
                      </div>
                    )}
                  </div>

                  <Btn
                    onClick={() => handleRestore(entry)}
                    disabled={entry.isCurrentVersion || restoringId === entry.id}
                    variant={entry.isCurrentVersion ? 'secondary' : 'gold'}
                  >
                    {entry.isCurrentVersion ? 'Current Version' : restoringId === entry.id ? 'Restoring…' : 'Restore'}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Close</Btn>
      </ModalFooter>
    </Modal>
  );
}
