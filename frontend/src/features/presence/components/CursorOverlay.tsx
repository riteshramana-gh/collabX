import React, { useEffect, useState } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { CursorPosition } from '../../../types/protocol';
import { MousePointer2 } from 'lucide-react';

interface CursorOverlayProps {
  conn: ConnectionManager;
  panX: number;
  panY: number;
  zoom: number;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ conn, panX, panY, zoom }) => {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  useEffect(() => {
    const unsub = conn.on('PRESENCE_UPDATE', (envelope) => {
      const cursor = envelope.payload as CursorPosition;
      if (!cursor.session_id) return;

      setCursors((prev) => {
        const next = new Map(prev);
        next.set(cursor.session_id, cursor);
        return next;
      });
    });

    // Clean up stale cursors every 5 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, c] of next.entries()) {
          if (now - c.timestamp > 8000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);

    return () => {
      unsub();
      clearInterval(cleanupInterval);
    };
  }, [conn]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 30,
      }}
    >
      {Array.from(cursors.values()).map((c) => {
        // Transform world coordinates back to screen coordinates
        const screenX = c.x * zoom + panX;
        const screenY = c.y * zoom + panY;

        return (
          <div
            key={c.session_id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
              transition: 'left 0.05s linear, top 0.05s linear',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ color: c.color, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
              <MousePointer2 size={18} fill={c.color} />
            </div>
            <div
              style={{
                marginLeft: 14,
                marginTop: -4,
                padding: '2px 8px',
                borderRadius: 6,
                background: c.color,
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {c.display_name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
