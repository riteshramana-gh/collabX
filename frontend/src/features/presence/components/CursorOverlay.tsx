import React, { useEffect, useState } from 'react';
import { ConnectionManager } from '../../../core/network/ConnectionManager';
import { CursorPosition } from '../../../types/protocol';
import { MousePointer2, Crown } from 'lucide-react';

interface CursorOverlayProps {
  conn: ConnectionManager;
  panX: number;
  panY: number;
  zoom: number;
  hostSessionId?: string | null;
  allowedCursorSessionIds?: Set<string>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  conn,
  panX,
  panY,
  zoom,
  hostSessionId,
  allowedCursorSessionIds = new Set(),
}) => {
  const [cursors, setCursors] = useState<Map<string, CursorPosition & { is_host?: boolean }>>(new Map());

  useEffect(() => {
    // 1. Inbound cursor update
    const unsubUpdate = conn.on('PRESENCE_UPDATE', (envelope) => {
      const cursor = envelope.payload as CursorPosition & { is_host?: boolean };
      if (!cursor.session_id) return;

      const isHostCursor = cursor.is_host || cursor.session_id === hostSessionId;
      const isAllowedParticipant = allowedCursorSessionIds.has(cursor.session_id);

      // Only store/display Host cursor or explicitly allowed participant cursors
      if (!isHostCursor && !isAllowedParticipant) {
        return;
      }

      setCursors((prev) => {
        const next = new Map(prev);
        next.set(cursor.session_id, cursor);
        return next;
      });
    });

    // 2. Explicit cursor removal (e.g. participant revoked or turned into viewer)
    const unsubRemove = conn.on('PRESENCE_CURSOR_REMOVE', (envelope) => {
      const targetId = envelope.payload?.session_id;
      if (targetId) {
        setCursors((prev) => {
          if (!prev.has(targetId)) return prev;
          const next = new Map(prev);
          next.delete(targetId);
          return next;
        });
      }
    });

    // 3. User demoted to VIEWER -> remove cursor immediately
    const unsubRole = conn.on('PRESENCE_ROLE_CHANGED', (envelope) => {
      const { session_id, role } = envelope.payload || {};
      if (session_id && role === 'VIEWER') {
        setCursors((prev) => {
          if (!prev.has(session_id)) return prev;
          const next = new Map(prev);
          next.delete(session_id);
          return next;
        });
      }
    });

    // 4. Permissions update broadcast
    const unsubPerms = conn.on('CURSOR_PERMISSIONS_UPDATE', (envelope) => {
      const allowedList = new Set<string>((envelope.payload?.allowed_session_ids || []) as string[]);
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, c] of next.entries()) {
          const isHostCursor = c.is_host || id === hostSessionId;
          if (!isHostCursor && !allowedList.has(id)) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    // 5. Clean up stale cursors every 4 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, c] of next.entries()) {
          if (now - c.timestamp > 6000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 4000);

    return () => {
      unsubUpdate();
      unsubRemove();
      unsubRole();
      unsubPerms();
      clearInterval(cleanupInterval);
    };
  }, [conn, hostSessionId, allowedCursorSessionIds]);

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
        const isHost = c.is_host || c.session_id === hostSessionId;

        return (
          <div
            key={c.session_id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
              transition: 'left 0.04s linear, top 0.04s linear',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                color: isHost ? '#f59e0b' : c.color,
                filter: isHost
                  ? 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.7))'
                  : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            >
              <MousePointer2 size={isHost ? 20 : 17} fill={isHost ? '#f59e0b' : c.color} />
            </div>
            <div
              style={{
                marginLeft: 14,
                marginTop: -4,
                padding: '2px 8px',
                borderRadius: 6,
                background: isHost ? '#f59e0b' : c.color,
                color: isHost ? '#0f172a' : '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isHost && <Crown size={11} />}
              <span>{isHost ? `Host (${c.display_name})` : c.display_name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
