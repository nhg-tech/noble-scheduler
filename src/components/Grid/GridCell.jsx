import { useDroppable } from '@dnd-kit/core';

export default function GridCell({ roleId, slotIdx, slotMin, isInShift, children }) {
  const id = `cell:${roleId}:${slotMin}`;

  const { isOver, setNodeRef } = useDroppable({ id, data: { type: 'cell', roleId, slotMin } });

  return (
    <div
      ref={setNodeRef}
      data-role={roleId}
      data-slot={slotIdx}
      style={{
        position: 'relative',
        height: '44px',
        borderBottom: '1px solid var(--gray-light)',
        background: isOver
          ? 'rgba(62,42,126,0.08)'
          : isInShift
            ? 'transparent'
            : 'rgba(0,0,0,0.03)',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}
