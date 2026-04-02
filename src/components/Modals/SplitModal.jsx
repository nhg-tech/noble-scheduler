import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';
import { getBlockDurationMin, keyToRoleAndMin, formatMin } from '../../utils/scheduling';

/**
 * SplitModal — split a block.
 *   Merged blocks: split back into constituents.
 *   Regular blocks: time-based split at user-specified point.
 * Props:
 *   blockKey: string
 *   task: task object
 *   onConfirm: (blockKey, splitAt) => void   — splitAt=null for merged splits
 *   onClose: () => void
 */
export default function SplitModal({ blockKey, task, onConfirm, onClose }) {
  if (!blockKey || !task) return null;
  const { startMin } = keyToRoleAndMin(blockKey);
  const totalDur = getBlockDurationMin(task);

  // Default split point: halfway (rounded to 5 min)
  const defaultSplit = Math.round(totalDur / 2 / 5) * 5 || Math.floor(totalDur / 2);
  const [splitAt, setSplitAt] = useState(defaultSplit);

  if (task.merged && task.constituents) {
    // Merged block — split back into constituents
    return (
      <Modal title="Split Merged Block" onClose={onClose} width={400}>
        <div style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 12px' }}>
            Split <strong>{task.name}</strong> starting at <strong>{formatMin(startMin)}</strong> back into individual blocks?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {task.constituents.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px', borderRadius: 7,
                  background: 'var(--gray-light)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: task.colors?.[i] || 'var(--purple)', flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{c.code}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>{c.name} · {c.durationMin} min</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--gray)' }}>
            Each block will be placed sequentially starting at {formatMin(startMin)}.
          </p>
        </div>

        <ModalFooter>
          <Btn onClick={onClose} variant="secondary">Cancel</Btn>
          <Btn onClick={() => onConfirm(blockKey, null)} variant="primary">Split</Btn>
        </ModalFooter>
      </Modal>
    );
  }

  // Regular block — time-based split
  const clampedSplit = Math.max(5, Math.min(totalDur - 5, splitAt));
  const secondDur = totalDur - clampedSplit;

  return (
    <Modal title="Split Block" onClose={onClose} width={380}>
      <div style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 14px' }}>
          Split <strong>{task.code}</strong> ({totalDur} min) starting at <strong>{formatMin(startMin)}</strong> into two blocks:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>
            SPLIT AFTER (minutes)
          </label>
          <input
            type="number"
            value={splitAt}
            min={5}
            max={totalDur - 5}
            step={5}
            onChange={e => setSplitAt(Number(e.target.value))}
            style={{
              width: 90, padding: '6px 8px',
              border: '1px solid var(--gray-light)', borderRadius: 5,
              fontSize: 13, fontFamily: "'DM Mono', monospace", outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={previewBox}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Part 1</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>
              {formatMin(startMin)} — {formatMin(startMin + clampedSplit)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--purple)' }}>{clampedSplit} min</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--gray)', fontSize: 16 }}>✂</div>
          <div style={previewBox}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Part 2</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>
              {formatMin(startMin + clampedSplit)} — {formatMin(startMin + totalDur)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--purple)' }}>{secondDur} min</div>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn
          onClick={() => onConfirm(blockKey, clampedSplit)}
          variant="primary"
          disabled={clampedSplit < 5 || secondDur < 5}
        >Split</Btn>
      </ModalFooter>
    </Modal>
  );
}

const previewBox = {
  flex: 1, padding: '8px 10px', borderRadius: 7,
  background: 'var(--gray-light)',
};
