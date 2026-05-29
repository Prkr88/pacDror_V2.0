import { useCallback } from 'react';

const DIRS = [
  { id: 'up',    dir: 3, label: '▲', area: 'up'    },
  { id: 'left',  dir: 1, label: '◀', area: 'left'  },
  { id: 'right', dir: 2, label: '▶', area: 'right' },
  { id: 'down',  dir: 4, label: '▼', area: 'down'  },
];

export default function DPad({ setDirection }) {
  const handleDir = useCallback((dir) => setDirection(dir), [setDirection]);

  return (
    <div className="dpad-overlay">
      {DIRS.map(({ id, dir, label, area }) => (
        <button
          key={id}
          className="dpad-btn"
          style={{ gridArea: area }}
          aria-label={`Move ${id}`}
          onTouchStart={e => { e.preventDefault(); handleDir(dir); }}
          onMouseDown={e => { e.preventDefault(); handleDir(dir); }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
