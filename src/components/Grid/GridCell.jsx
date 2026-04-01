import { useDroppable } from '@dnd-kit/core';

const SLOT_H = 22; // must match GridBody.jsx and TaskBlock.jsx

export default function GridCell({ roleId, slotIdx, slotMin, isInShift, isMidnight, onContextMenu, children }) {
  const id = `cell:${roleId}:${slotMin}`;

  const { isOver, setNodeRef } = useDroppable({ id, data: { type: 'cell', roleId, slotMin } });

  function handleContextMenu(e) {
    e.preventDefault();
    onContextMenu?.(e, roleId, slotMin);
  }

  return (
    <div
      ref={setNodeRef}
      data-role={roleId}
      data-slot={slotIdx}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        height: SLOT_H,
        borderBottom: isMidnight ? '2px solid var(--purple)' : '1px solid var(--gray-light)',
        borderTop: isMidnight ? '2px solid var(--purple)' : undefined,
        background: isOver
          ? 'rgba(62,42,126,0.08)'
          : isMidnight
            ? 'rgba(62,42,126,0.06)'
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
