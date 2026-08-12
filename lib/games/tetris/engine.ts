export const WORLD_W = 800; // igual que asteroids, coincide con .crt-screen (4:3)
export const WORLD_H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600 — coincide exacto con WORLD_H

const NEXT_PANEL_X = 320;
const NEXT_BOX_SIZE = 4 * BLOCK; // 120, mismo tamaño de bloque que el tablero
const NEXT_BOX_X = NEXT_PANEL_X + (WORLD_W - NEXT_PANEL_X - NEXT_BOX_SIZE) / 2;
const NEXT_BOX_Y = 110;
const NEXT_LABEL_Y = 70;

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

export type TetrisInput = {
  left: boolean; // un paso por pulsación (edge-triggered)
  right: boolean; // un paso por pulsación (edge-triggered)
  softDrop: boolean; // un paso por pulsación (edge-triggered)
  rotate: boolean; // edge-triggered, con wall-kicks [0,±1,±2]
  hardDrop: boolean; // edge-triggered
};

export type TetrisState = {
  status: "playing" | "gameover"; // sin estado "dead": Tetris no tiene vidas/respawn
  score: number;
  level: number;
  lines: number; // líneas limpiadas acumuladas
};

type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Piece = {
  type: PieceType;
  shape: number[][];
  x: number;
  y: number;
};

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = (Math.floor(Math.random() * 8) + 1) as PieceType;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export class TetrisEngine {
  private board: number[][] = createBoard();
  private current: Piece = randomPiece();
  private next: Piece = randomPiece();
  private score = 0;
  private lines = 0;
  private level = 1;
  private status: TetrisState["status"] = "playing";
  private dropInterval = 1000;
  private dropAccumMs = 0;

  private prevLeft = false;
  private prevRight = false;
  private prevSoftDrop = false;
  private prevRotate = false;
  private prevHardDrop = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.status = "playing";
    this.dropInterval = 1000;
    this.dropAccumMs = 0;
    this.prevLeft = false;
    this.prevRight = false;
    this.prevSoftDrop = false;
    this.prevRotate = false;
    this.prevHardDrop = false;
    this.next = randomPiece();
    this.spawn();
  }

  private spawn(): void {
    this.current = this.next;
    this.next = randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.status = "gameover";
    }
  }

  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private tryRotate(): void {
    const rotated = rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge(): void {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop(): void {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDropStep(): void {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  private lockPiece(): void {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private isGameOver(): boolean {
    return this.status === "gameover";
  }

  update(dt: number, input: TetrisInput): void {
    const leftPressed = input.left && !this.prevLeft;
    const rightPressed = input.right && !this.prevRight;
    const softDropPressed = input.softDrop && !this.prevSoftDrop;
    const rotatePressed = input.rotate && !this.prevRotate;
    const hardDropPressed = input.hardDrop && !this.prevHardDrop;
    this.prevLeft = input.left;
    this.prevRight = input.right;
    this.prevSoftDrop = input.softDrop;
    this.prevRotate = input.rotate;
    this.prevHardDrop = input.hardDrop;

    if (this.isGameOver()) return;

    if (
      leftPressed &&
      !this.collide(this.current.shape, this.current.x - 1, this.current.y)
    ) {
      this.current.x--;
    }
    if (
      rightPressed &&
      !this.collide(this.current.shape, this.current.x + 1, this.current.y)
    ) {
      this.current.x++;
    }
    if (rotatePressed) this.tryRotate();
    if (softDropPressed) this.softDropStep();
    if (hardDropPressed) this.hardDrop();

    if (this.isGameOver()) return;

    this.dropAccumMs += dt * 1000;
    if (this.dropAccumMs >= this.dropInterval) {
      this.dropAccumMs = 0;
      if (
        !this.collide(this.current.shape, this.current.x, this.current.y + 1)
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    this.drawBoard(ctx);
    this.drawNextPanel(ctx);
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    colorIndex: number,
    size: number,
    alpha = 1,
    offsetX = 0,
    offsetY = 0
  ): void {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex] as string;
    ctx.fillRect(
      offsetX + cellX * size + 1,
      offsetY + cellY * size + 1,
      size - 2,
      size - 2
    );
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(
      offsetX + cellX * size + 1,
      offsetY + cellY * size + 1,
      size - 2,
      4
    );
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, BOARD_W - 1, BOARD_H - 1);
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    this.drawGrid(ctx);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c], BLOCK);

    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2
          );

    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK
        );
  }

  private drawNextPanel(ctx: CanvasRenderingContext2D): void {
    const panelCenterX = NEXT_PANEL_X + (WORLD_W - NEXT_PANEL_X) / 2;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("NEXT", panelCenterX, NEXT_LABEL_Y);

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      NEXT_BOX_X - 10,
      NEXT_BOX_Y - 10,
      NEXT_BOX_SIZE + 20,
      NEXT_BOX_SIZE + 20
    );

    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(
          ctx,
          offX + c,
          offY + r,
          shape[r][c],
          BLOCK,
          1,
          NEXT_BOX_X,
          NEXT_BOX_Y
        );
  }

  getState(): TetrisState {
    return {
      status: this.status,
      score: this.score,
      level: this.level,
      lines: this.lines,
    };
  }
}
