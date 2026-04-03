import type { Position, PieceSide } from '../types.js';

/**
 * Pure xiangqi rules — no side effects, no external dependencies.
 */
export class XiangqiRules {
  /**
   * Validate a move: 1 piece moved, correct side, no spawning, no friendly capture.
   */
  static validateMove(oldPos: Position, newPos: Position, currentTurn: PieceSide): { valid: boolean; error?: string } {
    let movedFrom: string | null = null;
    let movedPiece: string | null = null;

    for (const sq of Object.keys(oldPos)) {
      if (!newPos[sq] && oldPos[sq]) {
        movedFrom = sq;
        movedPiece = oldPos[sq];
      }
    }

    let movedTo: string | null = null;
    for (const sq of Object.keys(newPos)) {
      if (!oldPos[sq] || oldPos[sq] !== newPos[sq]) {
        movedTo = sq;
      }
    }

    if (!movedFrom || !movedPiece || !movedTo) {
      return { valid: false, error: 'Cannot determine move' };
    }

    if (movedPiece[0] !== currentTurn) {
      return { valid: false, error: `Not your piece. Expected '${currentTurn}', got '${movedPiece[0]}'` };
    }

    const capturedPiece = oldPos[movedTo];
    if (capturedPiece && capturedPiece[0] === currentTurn) {
      return { valid: false, error: 'Cannot capture your own piece' };
    }

    const newCount = Object.values(newPos).filter(p => p[0] === currentTurn).length;
    const oldCount = Object.values(oldPos).filter(p => p[0] === currentTurn).length;
    if (newCount > oldCount) {
      return { valid: false, error: 'Piece count increased — cheat detected' };
    }

    if (newPos[movedTo] !== movedPiece) {
      return { valid: false, error: 'Piece transformation detected' };
    }

    return { valid: true };
  }

  /**
   * Check if a king is missing.
   * Returns 'host' if bK missing (red wins), 'opponent' if wK missing (black wins), null if both alive.
   */
  static checkWinner(pos: Position): 'host' | 'opponent' | null {
    const pieces = Object.values(pos);
    if (!pieces.includes('bK')) return 'host';
    if (!pieces.includes('wK')) return 'opponent';
    return null;
  }
}
