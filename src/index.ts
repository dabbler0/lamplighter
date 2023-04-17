import { Application, Sprite, Assets, Texture, Resource, Container } from 'pixi.js';
import {DropShadowFilter} from '@pixi/filter-drop-shadow';

enum Direction {
  up = 'up',
  down = 'down',
  right = 'right',
  left = 'left'
};

function add(i: number, j: number, d: Direction): [number, number] {
  return d === Direction.up ? [i, j - 1] :
    d === Direction.down ? [i, j + 1] :
    d === Direction.right ? [i + 1, j] :
    [i - 1, j];
}

class List<T> {
  next?: List<T>;
  constructor (
    public head: T,
    public prev?: List<T>) {

    if (this.prev) prev.next = this;

    this.next = null;
  }

  some (fn: (t: T) => boolean): boolean {
    return fn(this.head) || (!!this.prev && this.prev.some(fn));
  }
  forEach (fn: (t: T) => void): void {
    fn(this.head);
    if (this.prev) this.prev.forEach(fn);
  }
}

class HamiltonianBoard {
  goldPath: List<[number, number]>;
  edges: Set<string>;
  constructor (w: number, h: number) {
    this.edges = new Set<string>();

    // "random nudging" to create the path
    this.goldPath = new List(
      [0, 1],
      new List(
        [1, 1],
        new List(
          [1, 0],
          new List(
            [0, 0]
          )
        )
      )
    );

    const taken = new Set<string>();
    this.goldPath.forEach(([i, j]) => taken.add(`${i}:${j}`));

    for (let i = 0; i < w * h / 2; i++) {
      const candidates: [
        List<[number, number]>,
        [number, number],
        [number, number],
        List<[number, number]>
      ][] = [];
      for (let cursor = this.goldPath; !!cursor.prev; cursor = cursor.prev) {
        if (!cursor.prev) break;

        // This edge:
        const [i1, j1] = cursor.head;
        const [i2, j2] = cursor.prev.head;

        const tries = i1 === i2 ? [
          [[i1 + 1, j1], [i2 + 1, j2]],
          [[i1 - 1, j1], [i2 - 1, j2]]
        ] : [
          [[i1, j1 + 1], [i2, j2 + 1]],
          [[i1, j1 - 1], [i2, j2 - 1]]
        ];


        for (const [[di1, dj1], [di2, dj2]] of tries) {
          if (di1 >= 0 && di2 >= 0 && dj1 >= 0 && dj2 >= 0 &&
              di1 < w && di2 < w && dj1 < h && dj2 < h &&
              !taken.has(`${di1}:${dj1}`) && !taken.has(`${di2}:${dj2}`)) {
                candidates.push([
                  cursor.prev,
                  [di2, dj2],
                  [di1, dj1],
                  cursor,
                ]);
          } 
        }
      }

      if (candidates.length === 0) break;

      const [tail, a, b, head] = candidates[Math.floor(Math.random() * candidates.length)];

      head.prev = new List(b, new List(a, tail));
      head.prev.next = head;
      taken.add(`${a[0]}:${a[1]}`);
      taken.add(`${b[0]}:${b[1]}`);
    }

    // Random DFS to create the path
    /*
    const pathCandidates = [
      new List<[number, number]>([0, 0])
    ];

    while (pathCandidates.length > 0) {
      const consider = pathCandidates.pop();
      const [i, j] = consider.head;

      if (consider.length > w * h / 3) {
        this.goldPath = consider;
        break;
      }

      Object.values(Direction)
        .map((d) => add(i, j, d))
        .filter(([ci, cj]) =>
          ci >= 0 && ci < w &&
          cj >= 0 && cj < h &&
          !consider.some(([pi, pj]) => pi === ci && pj === cj)
        ).sort(
          () => Math.random() > 0.5 ? 1 : -1
        ).forEach((candidate) => {
          pathCandidates.push(new List<[number, number]>(candidate, consider));
        });
    }
    */

    for (let cursor = this.goldPath; !!cursor; cursor = cursor.prev) {
      const [ni, nj] = cursor.head;
      Object.values(Direction).map((d) => add(ni, nj, d))
        .forEach(([ci, cj]) => {
          if (
            this.goldPath.some(([oi, oj]) => oi == ci && oj === cj) &&
            Math.random() < 0.2) {
            this.addEdge(cursor.head, [ci, cj]);
          }
        });

      if (cursor.prev) {
        this.addEdge(cursor.head, cursor.prev.head);
      }
    }
    this.addEdge([0, 0], [0, 1]);
  }

  addEdge([i1, j1]: [number, number], [i2, j2]: [number, number]) {
    const [left, right] = [
      `${i1}:${j1}`,
      `${i2}:${j2}`
    ].sort();

    this.edges.add(`${left}::${right}`);
  }
}

async function main() {
  const app = new Application<HTMLCanvasElement>();

  document.body.appendChild(app.view);

  app.stage.position.x = app.screen.width / 2;
  app.stage.position.y = app.screen.height / 2;

  const textures = {
    face: await Assets.load('/assets/face.png'),
    back: await Assets.load('/assets/back.png'),
    side: await Assets.load('/assets/side.png'),
    platform: await Assets.load('/assets/platform.png'),
    platformBroken: await Assets.load('/assets/platform-broken.png'),
    bridge: await Assets.load('/assets/bridge.png'),
    tile1: await Assets.load('/assets/tile1.png'),
    tile2: await Assets.load('/assets/tile2.png'),
    tile3: await Assets.load('/assets/tile3.png'),
    tile4: await Assets.load('/assets/tile4.png'),
    tile5: await Assets.load('/assets/tile5.png'),
  };


  const roomSize = 10;
  const tileScale = 1;
  for (let i = -4; i <= roomSize * 4; i++) {
    for (let j = -4; j <= roomSize * 4; j++) {
      const tileTextures: Texture<Resource>[] = [textures.tile1, textures.tile2, textures.tile1, textures.tile4, textures.tile5];
      const tileTexture = tileTextures[Math.floor(Math.random() * tileTextures.length)];

      const tile = new Sprite(tileTexture);
      tile.scale.x = 0.25;
      tile.scale.y = 0.25;
      tile.position.x = i * 25;
      tile.position.y = j * 25;
      app.stage.addChild(tile);
    }
  }

  const hamiltonianBoard = new HamiltonianBoard(
    roomSize,
    roomSize,
  );

  const shadow = new DropShadowFilter();
  shadow.alpha = 0.5;
  shadow.distance = 50;

  const walkway = new Container();
  walkway.filters = [shadow];
  app.stage.addChild(walkway);

  const platforms: { platform: Sprite; working: boolean; }[] = [];

  for (let cursor = hamiltonianBoard.goldPath; !!cursor; cursor = cursor.prev) {
    const platform = new Sprite(textures.platform);
    const [i, j] = cursor.head;

    platform.anchor.x = 0.5;
    platform.anchor.y = 0.5;

    platform.scale.x = 0.25;
    platform.scale.y = 0.25;

    platform.position.x = i * 100;
    platform.position.y = j * 100;

    walkway.addChild(platform);
    platforms.push({ platform, working: true });
  }

  const bridges: Sprite[] = [];

  Array.from(hamiltonianBoard.edges).forEach((edge) => {
    const [
      [i1, j1],
      [i2, j2]
    ] = edge.split('::').map((x) => x.split(':').map(Number));

    const bridge = new Sprite(textures.bridge);
    bridge.anchor.x = 0.5;
    bridge.anchor.y = 0.5;

    bridge.rotation = j1 == j2 ? 0 : Math.PI / 2;

    bridge.scale.x = 0.25;
    bridge.scale.y = 0.25;

    bridge.position.x = (i1 + i2) / 2 * 100;
    bridge.position.y = (j1 + j2) / 2 * 100;

    walkway.addChild(bridge);
    bridges.push(bridge);
  });

  const player = new Sprite(textures.face);
  player.anchor.x = 0.5;
  player.anchor.y = 0.8;

  const scale = 0.2;
  player.scale.x = scale;
  player.scale.y = scale;

  app.stage.addChild(player);

  const keysdown: Record<string, boolean> = {};

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    if (event.key === 'r') {
      player.position.x = 0;
      player.position.y = 0;
      platforms.forEach((obj) => {
        obj.working = true
        obj.platform.texture = textures.platform
      });
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  const speed = 5;

  let currentPlatform: Sprite | null = null;

  app.ticker.add((delta) => {
    const originalX = player.position.x;
    const originalY = player.position.y;

    if (keysdown.ArrowUp) {
      player.texture = textures.back;
      player.position.y -= speed * delta;
    }
    if (keysdown.ArrowDown) {
      player.texture = textures.face;
      player.position.y += speed * delta;
    }
    if (keysdown.ArrowRight) {
      player.texture = textures.side;
      player.scale.x = scale;
      player.position.x += speed * delta;
    }
    if (keysdown.ArrowLeft) {
      player.texture = textures.side;
      player.scale.x = -scale;
      player.position.x -= speed * delta;
    }

    if (!(bridges.some((bridge) =>
      Math.abs(bridge.position.x - player.position.x) < (bridge.rotation === 0 ? 25 : 20) &&
      Math.abs(bridge.position.y - player.position.y) < (bridge.rotation === 0 ? 20 : 25)
    ) || platforms.some(({ platform, working }) => working &&
      Math.abs(platform.position.x - player.position.x) < 25 &&
      Math.abs(platform.position.y - player.position.y) < 25
    ) || (
      Math.abs(currentPlatform.position.x - player.position.x) < 25 &&
      Math.abs(currentPlatform.position.y - player.position.y) < 25
    ))) {
      player.position.x = originalX;
      player.position.y = originalY;
    } else {
      platforms.forEach((obj) => {
        const { platform } = obj;
        if (Math.abs(platform.position.x - player.position.x) < 25 &&
            Math.abs(platform.position.y - player.position.y) < 25) {
          platform.texture = textures.platformBroken;
          obj.working = false;
          currentPlatform = platform;
        }
      });
    }

    app.stage.position.x = app.screen.width / 2 - player.position.x;
    app.stage.position.y = app.screen.height / 2 - player.position.y;
  });
}

main();
