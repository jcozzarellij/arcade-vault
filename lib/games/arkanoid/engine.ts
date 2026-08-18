export const WORLD_W = 800; // igual que asteroids/tetris, coincide con .crt-screen (4:3)
export const WORLD_H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (WORLD_W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const BALL_SIZE = 16;
const EXPLOSION_DURATION = 150; // ms, mismo timing que el original (antes 4 frames de sprite, ahora flash vectorial)
const POINTS_PER_BLOCK = 10;
const INITIAL_LIVES = 3;

type LevelBlock = { col: number; row: number; color: string };
type Level = { speed: number; blocks: LevelBlock[] };

// Port 1:1 de levels.js — plegado como constante privada, igual que PIECES/COLORS en TetrisEngine.
const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

type Paddle = { x: number; y: number; w: number; h: number };
type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
};

export type ArkanoidInput = {
  left: boolean; // continuo, mientras se mantiene presionada la tecla
  right: boolean; // continuo, mientras se mantiene presionada la tecla
};

export type ArkanoidState = {
  status: "playing" | "gameover"; // "gameover" tanto al perder todas las vidas como al limpiar el nivel 5
  score: number;
  lives: number;
  level: number;
};

function collideAABB(ball: Ball, block: Block): boolean {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

export class ArkanoidEngine {
  private paddle: Paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  private ball: Ball = {
    x: 0,
    y: 0,
    w: BALL_SIZE,
    h: BALL_SIZE,
    vx: BASE_BALL_VX,
    vy: BASE_BALL_VY,
  };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private lives = INITIAL_LIVES;
  private score = 0;
  private status: ArkanoidState["status"] = "playing";
  private currentLevel = 1;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.status = "playing";
    this.initPaddle();
    this.loadLevel(1);
  }

  private initPaddle(): void {
    this.paddle.x = (WORLD_W - this.paddle.w) / 2;
  }

  private initBall(): void {
    const speed = LEVELS[this.currentLevel - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number): void {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.initBall();
  }

  update(dt: number, input: ArkanoidInput): void {
    if (this.status !== "playing") return;

    const { paddle, ball } = this;

    if (input.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (input.right)
      paddle.x = Math.min(WORLD_W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= WORLD_W) {
      ball.x = WORLD_W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (collideAABB(ball, block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < 5) this.loadLevel(this.currentLevel + 1);
          else this.status = "gameover"; // "win" del original se mapea al mismo gameover
        }
        break; // un bloque por frame, igual que el original
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION
    );

    if (ball.y > WORLD_H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.status = "gameover";
      } else {
        this.initBall();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    for (const block of this.blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) {
      const progress = exp.elapsed / EXPLOSION_DURATION;
      const cx = exp.x + exp.w / 2;
      const cy = exp.y + exp.h / 2;
      const radius = Math.max(exp.w, exp.h) * (0.5 + progress * 0.6);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = exp.color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#e6e9ff";
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    ctx.fillStyle = "#e6e9ff";
    ctx.beginPath();
    ctx.arc(
      this.ball.x + this.ball.w / 2,
      this.ball.y + this.ball.h / 2,
      this.ball.w / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  getState(): ArkanoidState {
    return {
      status: this.status,
      score: this.score,
      lives: this.lives,
      level: this.currentLevel,
    };
  }
}
