import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';

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

    function allBetween([i1, j1]: [number, number], [i2, j2]: [number, number]): [number, number][] {
      if (i1 === i2) {
        if (j2 < j1) return [...Array(j1 - j2 + 1)].map((_, delta) => [i1, j1 - delta]);
        return [...Array(j2 - j1 + 1)].map((_, delta) => [i1, j1 + delta]);
      }
      else if (j1 === j2) {
        if (i2 < i1) return [...Array(i1 - i2 + 1)].map((_, delta) => [i1 - delta, j1]);
        return [...Array(i2 - i1 + 1)].map((_, delta) => [i1 + delta, j1]);
      }
      return [];
    }

    function valid([i, j]: [number, number]): boolean {
      return i >= 0 && j >= 0 && i < w && j < h && !taken.has(`${i}:${j}`);
    }

    for (let i = 0; i < w * h / 3; i++) {
      const candidates: [
        List<[number, number]>,
        [number, number][],
        List<[number, number]>
      ][] = [];
      for (let cursor = this.goldPath; !!cursor.prev; cursor = cursor.prev) {
        // This edge:
        const [i1, j1] = cursor.head;
        // Direction:
        const iDirection = cursor.head[0] === cursor.prev.head[0];

        for (let tail = cursor.prev; !!tail; tail = tail.prev) {
          const [i2, j2] = tail.head;

          if (iDirection && i2 !== i1) break;
          if (!iDirection && j2 !== j1) break;

          const tries = i1 === i2 ? [
            allBetween([i2 + 1, j2], [i1 + 1, j1]),
            allBetween([i2 - 1, j2], [i1 - 1, j1]),
          ] : [
            allBetween([i2, j2 + 1], [i1, j1 + 1]),
            allBetween([i2, j2 - 1], [i1, j1 - 1])
          ];

          for (const t of tries) {
            if (t.every(valid)) {
              candidates.push(
                [
                  tail, t, cursor,
                ]
              );
            }
          }
        }
      }

      if (candidates.length === 0) break;

      const [tail, t, head] = candidates[
        Math.floor(Math.random() * candidates.length)
      ];

      // Intermediates no longer taken
      for (let cursor = head.prev; cursor !== tail; cursor = cursor.prev) {
        const [i, j] = cursor.head;
        taken.delete(`${i}:${j}`);
      }

      // Insert intermediates
      let insertList = tail;
      for (let [i, j] of t) {
        insertList = new List([i, j], insertList);
        taken.add(`${i}:${j}`);
      }

      head.prev = insertList;
      insertList.next = head;
    }

    console.log(this.goldPath);

    for (let cursor = this.goldPath; !!cursor; cursor = cursor.prev) {
      const [ni, nj] = cursor.head;
      Object.values(Direction).map((d) => add(ni, nj, d))
        .forEach(([ci, cj]) => {
          if (
            this.goldPath.some(([oi, oj]) => oi == ci && oj === cj) &&
            Math.random() < 0.4) {
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

  const textures = {
    face: await Assets.load('/assets/face.png'),
    back: await Assets.load('/assets/back.png'),
    right1: await Assets.load('/assets/side.png'),
    left1: (await Assets.load('/assets/side.png')).clone(),
    right2: await Assets.load('/assets/side2.png'),
    left2: (await Assets.load('/assets/side2.png')).clone(),
    platform: await Assets.load('/assets/platform.png'),
    platformBroken: await Assets.load('/assets/platform-broken.png'),
    bridge: await Assets.load('/assets/bridge.png'),
    stoneTop: await Assets.load('/assets/stone-top.png'),
    stoneMid: await Assets.load('/assets/stone-mid.png'),
    stoneUnder: await Assets.load('/assets/stone-under.png'),
    lightTop: await Assets.load('/assets/light-top.png'),
    lightMid: await Assets.load('/assets/light-mid.png'),
    litTop: await Assets.load('/assets/lit-top.png'),
    litMid: await Assets.load('/assets/lit-mid.png'),
    water1: await Assets.load('/assets/water1.png'),
    water2: await Assets.load('/assets/water2.png'),
    water3: await Assets.load('/assets/water3.png'),
    water4: await Assets.load('/assets/water4.png'),
  };

  textures.left1.rotate = groupD8.MIRROR_HORIZONTAL;
  textures.left2.rotate = groupD8.MIRROR_HORIZONTAL;

  app.stage = new Stage();

  const roomSize = 5;

  const hamiltonianBoard = new HamiltonianBoard(
    roomSize,
    roomSize,
  );

  const roomArray: string[][] = [];
  for (let i = 0; i < roomSize * 2 + 5; i++) {
    roomArray[i] = [];
    for (let j = 0; j < roomSize * 2 + 5; j++) {
      roomArray[i][j] = ' ';
    }
  }

  const platforms: { platform: Sprite; working: boolean; }[] = [];

  for (let cursor = hamiltonianBoard.goldPath; !!cursor; cursor = cursor.prev) {
    const platform = new Sprite(textures.platform);
    const [i, j] = cursor.head;

    roomArray[i * 2 + 2][j * 2 + 2] = '?';
  }

  roomArray[2][2] = '!';

  Array.from(hamiltonianBoard.edges).forEach((edge) => {
    const [
      [i1, j1],
      [i2, j2]
    ] = edge.split('::').map((x) => x.split(':').map(Number));

    roomArray[i1 + i2 + 2][j1 + j2 + 2] = '#';
  });

  for (let i = 0; i < roomSize * 2 + 5; i++) {
    roomArray[i][0] = '#';
    roomArray[i][roomSize * 2 + 4] = '#';
    roomArray[0][i] = '#';
    roomArray[roomSize * 2 + 4][i] = '#';
  }

  roomArray[2][1] = '#';

  const spriteArray: Sprite[][] = [];

  const scale = 40;

  const room = new Container();
  for (let i = 0; i < roomSize * 2 + 5; i++) {
    spriteArray[i] = [];
    for (let j = 0; j < roomSize * 2 + 5; j++) {
      const tile = new Sprite(
        j > 0 && roomArray[i][j - 1] !== ' ' ?
          (
            roomArray[i][j] === '?' ?
            textures.lightMid :
            roomArray[i][j] === '!' ?
            textures.litMid :
            roomArray[i][j] === '#' ?
            textures.stoneMid :
            textures.stoneUnder ) :
          (roomArray[i][j] === '?' ?
            textures.lightTop :
            roomArray[i][j] === '!' ?
            textures.litTop :
            roomArray[i][j] === '#' ?
            textures.stoneTop :
            [textures.water1, textures.water2, textures.water3, textures.water4][Math.floor(Math.random() * 4)])
      );

      tile.scale.x = scale / 200;
      tile.scale.y = scale / 200;
      tile.position.x = i * scale;
      tile.position.y = j * scale;

      spriteArray[i][j] = tile;

      room.addChild(tile);
    }
  }

  const player = new Sprite(
    textures.face
  );

  player.anchor.y = 0.3;

  player.scale.x = scale / 200;
  player.scale.y = scale / 200;

  const pos = [roomSize + 2, roomSize * 2 + 4];

  player.position.x = pos[0] * scale;
  player.position.y = pos[1] * scale;

  let active = true;

  const lighting = new Layer();
  const blur = new BlurFilter(20);
  const smallBlur = new BlurFilter();

  (lighting as any).on('display', (element: any) => {
    element.blendMode = BLEND_MODES.ADD;
  });

  lighting.useRenderTexture = true;
  lighting.clearColor = [0.2, 0.2, 0.2, 1]; // ambient gray

  const lightingSprite = new Sprite(lighting.getRenderTexture());
  lightingSprite.blendMode = BLEND_MODES.MULTIPLY;

  let chosenPath = [];
  let currentOrigin: [number, number] | null = null;
  let currentDest: [number, number] | null = null;
  let glideCounter = 0;

  const keysdown: Record<string, boolean> = {};
  let finished = false;

  function handleKeys () {
    const [i, j] = pos;
    if (i === 2 && j === 2) active = true;

    let moved = false;

    if (keysdown[ 'ArrowRight']) {
      if (i < roomSize * 2 + 5 - 1 && ['#', '?', '!'].includes(roomArray[i + 1][j])) {
        pos[0] += 1;
        moved = true;
      }
      if (![textures.right1, textures.right2].includes(player.texture)) {
        player.texture = textures.right1;
      }
    }
    else if (keysdown[ 'ArrowLeft']) {
      if (i > 0 && ['#', '?', '!'].includes(roomArray[i - 1][j])) {
        pos[0] -= 1;
        moved = true;
      }
      if (![textures.left1, textures.left2].includes(player.texture)) {
        player.texture = textures.left1;
      }
    }
    else if (keysdown[ 'ArrowUp']) {
      if (j > 0 && ['#', '?', '!'].includes(roomArray[i][j - 1])) {
        pos[1] -= 1;
        moved = true;
      }
      player.texture = textures.back;
    }
    else if (keysdown[ 'ArrowDown']) {
      if (j < roomSize * 2 + 5 - 1 && ['#', '?', '!'].includes(roomArray[i][j + 1])) {
        pos[1] += 1;
        moved = true;
      }
      player.texture = textures.face;
    }
    if (moved && roomArray[pos[0]][pos[1]] === '!' && !finished) {
      active = false;
      for (let oi = 0; oi < roomSize * 2 + 5; oi++) {
        for (let oj = 0; oj < roomSize * 2 + 5; oj++) {
          if (roomArray[oi][oj] === '!' && !(oi === 2 && oj === 2)) {
            roomArray[oi][oj] = '?';
            spriteArray[oi][oj].texture = textures.lightMid;
            spriteArray[oi][oj].removeChild(spriteArray[oi][oj].children[0]);

            chosenPath = [];
          }
        }
      }
    }

    if (roomArray[i][j] === '?' && active) {
      roomArray[i][j] = '!';

      if (roomArray.every((col) => col.every((cell) => cell !== '?'))) finished = true;

      spriteArray[i][j].texture = textures.litMid;

      chosenPath.push([i, j]);

      const lightbulb = new Graphics();
      lightbulb.beginFill(0xddffdd, 0.5);
      lightbulb.drawCircle(scale / 2, scale / 2, 500);
      lightbulb.endFill();
      (lightbulb as any).parentLayer = lighting;
      lightbulb.filters = [blur];
      spriteArray[i][j].addChild(lightbulb);
    }

    if (player.position.x !== pos[0] * scale || player.position.y !== pos[1] * scale) {
      currentOrigin = [player.position.x, player.position.y];
      currentDest = [pos[0] * scale, pos[1] * scale];
      glideCounter = 0;
    }
  }

  const firstBulb = new Graphics();
  firstBulb.beginFill(0xddffdd, 0.5);
  firstBulb.drawCircle(scale / 2, scale / 2, 500);
  firstBulb.endFill();
  (firstBulb as any).parentLayer = lighting;
  firstBulb.filters = [blur];
  spriteArray[2][2].addChild(firstBulb);

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    if (!currentOrigin && !currentDest) {
      console.log('handling keys');
      handleKeys();
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
    if (!keysdown['ArrowRight'] && player.texture === textures.right2) {
      player.texture = textures.right1;
    }
    if (!keysdown['ArrowLeft'] && player.texture === textures.left2) {
      player.texture = textures.left1;
    }
  });

  /*
  const lightbulb = new Graphics();
  lightbulb.beginFill(0xffffff, 0.5);
  lightbulb.drawCircle(scale / 2, scale / 2, 1000);
  lightbulb.endFill();
  (lightbulb as any).parentLayer = lighting;
  lightbulb.filters = [blur];
  player.addChild(lightbulb);
  */

  app.stage.addChild(room);
  room.addChild(player);
  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);

  let cycleCounter = 0;
  let waterCounter = 0;

  const speed = 0.15;
  let animateCounter = 0;

  let particles: { sprite: Graphics, age: number, vx: number, vy: number}[] = [];

  function addParticle(i: number, j: number) {
    const sprite = new Graphics();
    sprite.beginFill(0xffffff, 1);
    sprite.drawCircle(0, 0, 2);
    sprite.endFill();
    sprite.position.x = i * scale + scale / 2;
    sprite.position.y = j * scale + 5;
    room.addChild(sprite);
    particles.push({
      sprite,
      age: 0,
      vx: (Math.random() - 0.5) * 5,
      vy: 0,
    });
  }

  app.ticker.add((delta) => {
    if (currentOrigin && currentDest) {
      glideCounter += speed * delta;

      if (glideCounter >= 1) {
        player.position.x = currentDest[0];
        player.position.y = currentDest[1];
        currentOrigin = null;
        currentDest = null;
      } else {
        player.position.x = currentDest[0] * glideCounter + currentOrigin[0] * (1 - glideCounter);
        player.position.y = currentDest[1] * glideCounter + currentOrigin[1] * (1 - glideCounter);
      }
    }

    else {
      handleKeys();
    }
    room.position.x = app.screen.width / 2 - player.x;
    room.position.y = app.screen.height / 2 - player.y;

    lighting.position.x = app.screen.width / 2 - player.x;
    lighting.position.y = app.screen.height / 2 - player.y;

    if (waterCounter > 1) {
      for (let i = 0; i < roomSize * 2 + 5; i++) {
        for (let j = 0; j < roomSize * 2 + 5; j++) {
          if (roomArray[i][j] === ' ' && !(j > 0 && roomArray[i][j - 1] !== ' ')) {
            spriteArray[i][j].texture = [textures.water1, textures.water2, textures.water3, textures.water4][Math.floor(Math.random() * 4)];
          }
        }
      }
      waterCounter = 0;
    }
    waterCounter += delta * 0.025;

    if (animateCounter > 1 && currentDest) {
      if (player.texture === textures.right1) {
        player.texture = textures.right2;
      }
      else if (player.texture === textures.right2) {
        player.texture = textures.right1;
      }
      else if (player.texture === textures.left1) {
        player.texture = textures.left2;
      }
      else if (player.texture === textures.left2) {
        player.texture = textures.left1;
      }
      animateCounter = 0;
    }
    animateCounter += delta * 0.05;

    for (let i = 0; i < roomSize * 2 + 5; i++) {
      for (let j = 0; j < roomSize * 2 + 5; j++) {
        if (roomArray[i][j] === '!' && Math.random() > Math.pow(0.5, delta * 0.025)) {
          addParticle(i, j);
        }
      }
    }

    particles = particles.filter((particle) => {
      particle.age += delta;
      particle.sprite.position.x += particle.vx;
      particle.sprite.position.y += particle.vy;
      particle.sprite.alpha = 1 - particle.age / 30;
      particle.vx += delta * 0.1;
      particle.vy -= delta * 0.2;
      if (particle.age > 30) {
        room.removeChild(particle.sprite);
        return false;
      }
      return true;
    });


    /*

    if (chosenPath.length <= 1) {
      bullet.position.x = 0;
      bullet.position.y = 0;
    }
    else {
      if (cycleCounter >= chosenPath.length - 1) {
        cycleCounter = cycleCounter % chosenPath.length;
      }
      const cycleIndex = Math.floor(cycleCounter);
      const proportion = cycleCounter - cycleIndex;
      if (cycleIndex + 1 > chosenPath.length - 1) {
        return;
      }
      bullet.position.x = 
        chosenPath[cycleIndex][0] * (1 - proportion) * scale +
        chosenPath[cycleIndex + 1][0] * proportion * scale;

      bullet.position.y = 
        chosenPath[cycleIndex][1] * (1 - proportion) * scale +
        chosenPath[cycleIndex + 1][1] * proportion * scale;
    }
    */
  });
}

main();
