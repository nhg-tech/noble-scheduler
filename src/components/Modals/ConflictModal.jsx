import Modal, { ModalFooter, Btn } from './Modal';
import { formatMin } from '../../utils/scheduling';

/**
 * ConflictModal — shown when a dragged task would overlap an existing block.
 * Props:
 *   conflict: { draggedTask, targetRoleId, targetStartMin, existingBlockKey, existingTask, freeMinutes }
 *   onFit: () => void        — truncate/fit into available space
 *   onWaterfall: () => void  — allow overflow (red outline)
 *   onCancel: () => void     — abort the drop
 */
export default function ConflictModal({ conflict, onMerge, onFit, onWaterfall, onCancel }) {
  if (!conflict) return null;
  const { draggedTask, targetRoleId, targetStartMin, existingTask, freeMinutes, canMerge } = conflict;

  return (
    <Modal title="Schedule Conflict" onClose={onCancel} width={420}>
      <div style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 10px' }}>
          <strong>{draggedTask?.name || draggedTask?.code}</strong> overlaps an existing block at{' '}
          <strong>{formatMin(targetStartMin)}</strong>.
        </p>
        {existingTask && (
          <p style={{ margin: '0 0 10px', color: 'var(--gray)', fontSize: 12 }}>
            Existing: <strong>{existingTask.name || existingTask.code}</strong>
          </p>
        )}
        {freeMinutes !== undefined && (
          <p style={{ margin: '0 0 14px', color: 'var(--gray)', fontSize: 12 }}>
            Available space: <strong>{freeMinutes} min</strong>
          </p>
        )}

        <div style={{
          background: 'var(--gold-light)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: 'var(--dark)',
        }}>
          Choose how to handle this conflict:
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onCancel} variant="secondary">Cancel</Btn>
        <Btn onClick={onWaterfall} variant="secondary">Waterfall</Btn>
        <Btn onClick={onFit} variant="secondary">Fit into space</Btn>
        {canMerge && (
          <Btn onClick={onMerge} variant="primary">Merge blocks</Btn>
        )}
      </ModalFooter>
    </Modal>
  );
}
