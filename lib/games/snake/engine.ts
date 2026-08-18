import { FRUIT_ATLAS, FRUIT_ORDER } from "@/lib/games/snake/spriteAtlas";

export const WORLD_W = 800;
export const WORLD_H = 600;

const CELL = 20;
const COLS = 40; // WORLD_W / CELL
const ROWS = 30; // WORLD_H / CELL
const INITIAL_LENGTH = 3;
const SCORE_PER_FRUIT = 10;
const BASE_SPEED = 6; // cells/sec
const SPEED_STEP = 1.04; // multiplier per level
const SPEED_CAP = 2.2 * BASE_SPEED;

type Dir = { dx: number; dy: number };
const UP: Dir = { dx: 0, dy: -1 };
const DOWN: Dir = { dx: 0, dy: 1 };
const LEFT: Dir = { dx: -1, dy: 0 };
const RIGHT: Dir = { dx: 1, dy: 0 };

function isOpposite(a: Dir, b: Dir): boolean {
  return a.dx === -b.dx && a.dy === -b.dy;
}

type Cell = { x: number; y: number };

export type SnakeInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean; // los 4 se resuelven edge-triggered dentro del motor (flags "prev*"), con un giro en buffer
};

export type SnakeState = {
  status: "playing" | "gameover"; // sin "dead": Snake no tiene vidas/respawn
  score: number;
  level: number; // 1..FRUIT_ORDER.length, cíclico — índice de FRUIT_ORDER que define la fruta actual
  length: number; // segmentos actuales de la serpiente
};

export class SnakeEngine {
  private segments: Cell[] = [];
  private direction: Dir = RIGHT;
  private pendingDirection: Dir | null = null;
  private moveTimer = 0;
  private level = 1;
  private score = 0;
  private status: SnakeState["status"] = "playing";
  private fruitPos: Cell = { x: 0, y: 0 };
  private spriteImage: HTMLImageElement | null = null;
  private prevInput: SnakeInput = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  constructor() {
    this.reset();
  }

  reset(): void {
    const startY = Math.floor(ROWS / 2);
    const startX = Math.floor(COLS / 2);
    this.segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      this.segments.push({ x: startX - i, y: startY });
    }
    this.direction = RIGHT;
    this.pendingDirection = null;
    this.moveTimer = 0;
    this.level = 1;
    this.score = 0;
    this.status = "playing";
    this.prevInput = { up: false, down: false, left: false, right: false };
    this.spawnFruit();
  }

  setSprites(image: HTMLImageElement | null): void {
    this.spriteImage = image;
  }

  update(dt: number, input: SnakeInput): void {
    if (this.status !== "playing") return;

    this.handleInput(input);
    this.prevInput = { ...input };

    const stepInterval = 1 / this.currentSpeed();
    this.moveTimer += dt;
    while (this.moveTimer >= stepInterval && this.status === "playing") {
      this.moveTimer -= stepInterval;
      this.step();
    }
  }

  private handleInput(input: SnakeInput): void {
    const pressed = (key: keyof SnakeInput) =>
      input[key] && !this.prevInput[key];
    if (pressed("up")) this.pendingDirection = UP;
    else if (pressed("down")) this.pendingDirection = DOWN;
    else if (pressed("left")) this.pendingDirection = LEFT;
    else if (pressed("right")) this.pendingDirection = RIGHT;
  }

  private currentSpeed(): number {
    const speed = BASE_SPEED * Math.pow(SPEED_STEP, this.level - 1);
    return Math.min(speed, SPEED_CAP);
  }

  private step(): void {
    if (
      this.pendingDirection &&
      !isOpposite(this.pendingDirection, this.direction)
    ) {
      this.direction = this.pendingDirection;
    }
    this.pendingDirection = null;

    const head = this.segments[0];
    const newHead: Cell = {
      x: (head.x + this.direction.dx + COLS) % COLS,
      y: (head.y + this.direction.dy + ROWS) % ROWS,
    };

    const willEat =
      newHead.x === this.fruitPos.x && newHead.y === this.fruitPos.y;
    const bodyToCheck = willEat ? this.segments : this.segments.slice(0, -1);
    const collides = bodyToCheck.some(
      (s) => s.x === newHead.x && s.y === newHead.y
    );
    if (collides) {
      this.status = "gameover";
      return;
    }

    this.segments.unshift(newHead);
    if (willEat) {
      this.score += SCORE_PER_FRUIT;
      this.level = (this.level % FRUIT_ORDER.length) + 1;
      this.spawnFruit();
    } else {
      this.segments.pop();
    }
  }

  private spawnFruit(): void {
    let cell: Cell;
    do {
      cell = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (this.segments.some((s) => s.x === cell.x && s.y === cell.y));
    this.fruitPos = cell;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0a0f0a";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, WORLD_H);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(WORLD_W, r * CELL);
      ctx.stroke();
    }

    this.drawFruit(ctx);

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i];
      ctx.fillStyle = i === 0 ? "#7CFC7C" : "#3ea63e";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  private drawFruit(ctx: CanvasRenderingContext2D): void {
    const fruitName = FRUIT_ORDER[this.level - 1];
    const cx = this.fruitPos.x * CELL + CELL / 2;
    const cy = this.fruitPos.y * CELL + CELL / 2;

    if (!this.spriteImage) {
      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const rect = FRUIT_ATLAS[fruitName];
    const scale = CELL / Math.max(rect.w, rect.h);
    const dw = rect.w * scale;
    const dh = rect.h * scale;
    ctx.drawImage(
      this.spriteImage,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      cx - dw / 2,
      cy - dh / 2,
      dw,
      dh
    );
  }

  getState(): SnakeState {
    return {
      status: this.status,
      score: this.score,
      level: this.level,
      length: this.segments.length,
    };
  }
}
