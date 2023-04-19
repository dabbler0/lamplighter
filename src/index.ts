import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import HamiltonianBoard, { Direction, List } from './HamiltonianBoard';

class ActiveHamiltonianBoard {
  roomArray: string[][];
  spriteArray: Sprite[][];
  pos: [number, number];
  player: Sprite;
  door: Sprite;
  active: boolean;
  chosenPath: [number, number][];
  currentOrigin: [number, number] | null = null;
  currentDest: [number, number] | null = null;
  glideCounter: number;
  finished: boolean;
  room: Container;
  height: number;
  width: number;
  particles: { age: number; sprite: Graphics; vx: number; vy: number; }[];
  animateCounter: number;
  waterCounter: number;
  textures: Record<string, Texture>;
  app: Application;
  scale: number;
  blurFilter: Filter;
  lightingLayer: Layer;

  constructor (hamiltonianBoard: HamiltonianBoard, textures: Record<string, Texture>, scale: number, app: Application, blurFilter: Filter, lightingLayer: Layer) {
    this.textures = textures;
    this.app = app;
    this.scale = scale;
    this.blurFilter = blurFilter;
    this.lightingLayer = lightingLayer;
    this.waterCounter = 0;
    this.animateCounter = 0;

    this.roomArray = [];
    const { width, height } = hamiltonianBoard;
    this.width = width;
    this.height = height;
    for (let i = 0; i < width * 2 + 3; i++) {
      this.roomArray[i] = [];
      for (let j = 0; j < height * 2 + 3; j++) {
        this.roomArray[i][j] = ' ';
      }
    }

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        this.roomArray[i * 2 + 2][j * 2 + 2] = '#';
      }
    }

    for (let cursor = hamiltonianBoard.goldPath; !!cursor; cursor = cursor.prev) {
      const platform = new Sprite(textures.platform);
      const [i, j] = cursor.head;

      if (hamiltonianBoard.degree(...cursor.head) >= 3) {
        this.roomArray[i * 2 + 2][j * 2 + 2] = '?';
      }
    }

    this.roomArray[2][2] = '!';

    Array.from(hamiltonianBoard.edges).forEach((edge) => {
      const [
        [i1, j1],
        [i2, j2]
      ] = edge.split('::').map((x) => x.split(':').map(Number));

      this.roomArray[i1 + i2 + 2][j1 + j2 + 2] = '#';
    });

    for (let i = 0; i < width * 2 + 3; i++) {
      this.roomArray[0][i] = '#';
      this.roomArray[height * 2 + 2][i] = '#';
    }

    for (let i = 0; i < height * 2 + 3; i++) {
      this.roomArray[i][0] = '#';
      this.roomArray[i][width * 2 + 2] = '#';
    }

    this.roomArray[2][1] = '#';

    this.room = new Container();

    this.spriteArray = [];

    for (let i = 0; i < width * 2 + 3; i++) {
      this.spriteArray[i] = [];
      for (let j = 0; j < height * 2 + 3; j++) {
        const tile = new Sprite(
          j > 0 && this.roomArray[i][j - 1] !== ' ' ?
            (
              this.roomArray[i][j] === '?' ?
              textures.lightMid :
              this.roomArray[i][j] === '!' ?
              textures.litMid :
              this.roomArray[i][j] === '#' ?
              textures.stoneMid :
              textures.stoneUnder ) :
            (this.roomArray[i][j] === '?' ?
              textures.lightTop :
              this.roomArray[i][j] === '!' ?
              textures.litTop :
              this.roomArray[i][j] === '#' ?
              textures.stoneTop :
              [textures.water1, textures.water2, textures.water3, textures.water4][Math.floor(Math.random() * 4)])
        );

        tile.scale.x = scale / 200;
        tile.scale.y = scale / 200;
        tile.position.x = i * scale;
        tile.position.y = j * scale;

        this.spriteArray[i][j] = tile;

        this.room.addChild(tile);
      }
    }

    const firstBulb = new Graphics();
    firstBulb.beginFill(0xddffdd, 0.5);
    firstBulb.drawCircle(this.scale / 2 , this.scale / 2, 500);
    firstBulb.endFill();
    (firstBulb as any).parentLayer = this.lightingLayer;
    firstBulb.filters = [this.blurFilter];
    this.spriteArray[2][2].addChild(firstBulb);

    this.door = new Sprite(this.textures.door);
    this.room.addChild(this.door);
    this.door.position.x = (this.width + 1) * this.scale;
    this.door.position.y = -this.scale;

    this.door.scale.x = this.scale / 200;
    this.door.scale.y = this.scale / 200;

    this.player = new Sprite(
      textures.face
    );

    this.player.anchor.y = 0.3;

    this.player.scale.x = scale / 200;
    this.player.scale.y = scale / 200;

    this.pos = [width + 1, height * 2 + 2];

    this.room.addChild(this.player);

    this.player.position.x = this.pos[0] * scale;
    this.player.position.y = this.pos[1] * scale;

    this.active = true;

    this.chosenPath = [];
    this.currentOrigin = null;
    this.currentDest = null;
    this.glideCounter = 0;

    this.finished = false;

    this.particles = [];

    this.app.stage.addChild(this.room);
  }

  handleKeys (keysdown: Record<string, boolean>) {
    const [i, j] = this.pos;
    if (i === 2 && j === 2) this.active = true;

    let moved = false;

    if (keysdown['ArrowRight']) {
      if (i < this.width * 2 + 3 - 1 && ['#', '?', '!'].includes(this.roomArray[i + 1][j])) {
        this.pos[0] += 1;
        moved = true;
      }
      if (![this.textures.right1, this.textures.right2].includes(this.player.texture)) {
        this.player.texture = this.textures.right1;
      }
    }
    else if (keysdown['ArrowLeft']) {
      if (i > 0 && ['#', '?', '!'].includes(this.roomArray[i - 1][j])) {
        this.pos[0] -= 1;
        moved = true;
      }
      if (![this.textures.left1, this.textures.left2].includes(this.player.texture)) {
        this.player.texture = this.textures.left1;
      }
    }
    else if (keysdown['ArrowUp']) {
      if (j > 0 && ['#', '?', '!'].includes(this.roomArray[i][j - 1])) {
        this.pos[1] -= 1;
        moved = true;
      }
      this.player.texture = this.textures.back;
    }
    else if (keysdown['ArrowDown']) {
      if (j < this.height * 2 + 3 - 1 && ['#', '?', '!'].includes(this.roomArray[i][j + 1])) {
        this.pos[1] += 1;
        moved = true;
      }
      this.player.texture = this.textures.face;
    }
    if (moved && this.roomArray[this.pos[0]][this.pos[1]] === '!' && !this.finished) {
      this.active = false;
      for (let oi = 0; oi < this.width * 2 + 3; oi++) {
        for (let oj = 0; oj < this.height * 2 + 3; oj++) {
          if (this.roomArray[oi][oj] === '!' && !(oi === 2 && oj === 2)) {
            this.roomArray[oi][oj] = '?';
            this.spriteArray[oi][oj].texture = this.textures.lightMid;
            this.spriteArray[oi][oj].removeChild(this.spriteArray[oi][oj].children[0]);

            this.chosenPath = [];
          }
        }
      }
    }

    if (this.roomArray[i][j] === '?' && this.active) {
      this.roomArray[i][j] = '!';

      if (this.roomArray.every((col) => col.every((cell) => cell !== '?'))) {
        this.finished = true;

        const doorbulb = new Graphics();
        doorbulb.beginFill(0xffffff, 0.7);
        doorbulb.drawCircle(this.scale / 2, this.scale / 2, 500);
        doorbulb.endFill();
        (doorbulb as any).parentLayer = this.lightingLayer;
        doorbulb.filters = [this.blurFilter];

        this.door.addChild(doorbulb);
      }

      this.spriteArray[i][j].texture = this.textures.litMid;

      this.chosenPath.push([i, j]);

      const lightbulb = new Graphics();
      lightbulb.beginFill(0xddffdd, 0.5);
      lightbulb.drawCircle(this.scale / 2, this.scale / 2, 500);
      lightbulb.endFill();
      (lightbulb as any).parentLayer = this.lightingLayer;
      lightbulb.filters = [this.blurFilter];
      this.spriteArray[i][j].addChild(lightbulb);
    }

    if (this.player.position.x !==
      this.pos[0] * this.scale || this.player.position.y !== this.pos[1] * this.scale) {
      this.currentOrigin = [this.player.position.x, this.player.position.y];
      this.currentDest = [this.pos[0] * this.scale, this.pos[1] * this.scale];
      this.glideCounter = 0;
    }
  }

  addParticle (i: number, j: number) {
    const sprite = new Graphics();
    sprite.beginFill(0xffffff, 1);
    sprite.drawCircle(0, 0, 2);
    sprite.endFill();
    sprite.position.x = i * this.scale + this.scale / 2;
    sprite.position.y = j * this.scale + 3;
    this.room.addChild(sprite);
    this.particles.push({
      sprite,
      age: 0,
      vx: (Math.random() - 0.5) * 5,
      vy: 0,
    });
  }

  tick (delta: number, keysdown: Record<string, boolean>) {
    const speed = 0.15;
    if (this.currentOrigin && this.currentDest) {
      this.glideCounter += speed * delta;

      if (this.glideCounter >= 1) {
        this.player.position.x = this.currentDest[0];
        this.player.position.y = this.currentDest[1];
        this.currentOrigin = null;
        this.currentDest = null;
      } else {
        this.player.position.x = this.currentDest[0] * this.glideCounter + this.currentOrigin[0] * (1 - this.glideCounter);
        this.player.position.y = this.currentDest[1] * this.glideCounter + this.currentOrigin[1] * (1 - this.glideCounter);
      }
    }

    if (this.waterCounter > 1) {
      for (let i = 0; i < this.width * 2 + 3; i++) {
        for (let j = 0; j < this.height * 2 + 3; j++) {
          if (this.roomArray[i][j] === ' ' && !(j > 0 && this.roomArray[i][j - 1] !== ' ')) {
            this.spriteArray[i][j].texture = [this.textures.water1, this.textures.water2, this.textures.water3, this.textures.water4][Math.floor(Math.random() * 4)];
          }
        }
      }
      this.waterCounter = 0;
    }
    this.waterCounter += delta * 0.025;

    for (let i = 0; i < this.width * 2 + 3; i++) {
      for (let j = 0; j < this.height * 2 + 3; j++) {
        if (this.roomArray[i][j] === '!' && Math.random() > Math.pow(0.5, delta * 0.025)) {
          this.addParticle(i, j);
        }
      }
    }

    this.particles = this.particles.filter((particle) => {
      particle.age += delta;
      particle.sprite.position.x += particle.vx;
      particle.sprite.position.y += particle.vy;
      particle.sprite.alpha = 1 - particle.age / 30;
      particle.vx += delta * 0.1;
      particle.vy -= delta * 0.2;
      if (particle.age > 30) {
        this.room.removeChild(particle.sprite);
        return false;
      }
      return true;
    });
  }
}

async function main() {
  const app = new Application<HTMLCanvasElement>();

  document.body.appendChild(app.view);

  const textures = {
    face: await Assets.load('./assets/face.png'),
    back: await Assets.load('./assets/back.png'),
    right1: await Assets.load('./assets/side.png'),
    left1: (await Assets.load('./assets/side.png')).clone(),
    right2: await Assets.load('./assets/side2.png'),
    left2: (await Assets.load('./assets/side2.png')).clone(),
    platform: await Assets.load('./assets/platform.png'),
    platformBroken: await Assets.load('./assets/platform-broken.png'),
    bridge: await Assets.load('./assets/bridge.png'),
    stoneTop: await Assets.load('./assets/stone-top.png'),
    stoneMid: await Assets.load('./assets/stone-mid.png'),
    stoneUnder: await Assets.load('./assets/stone-under.png'),
    lightTop: await Assets.load('./assets/light-top.png'),
    lightMid: await Assets.load('./assets/light-mid.png'),
    litTop: await Assets.load('./assets/lit-top.png'),
    litMid: await Assets.load('./assets/lit-mid.png'),
    water1: await Assets.load('./assets/water1.png'),
    water2: await Assets.load('./assets/water2.png'),
    water3: await Assets.load('./assets/water3.png'),
    water4: await Assets.load('./assets/water4.png'),
    door: await Assets.load('./assets/door.png'),
  };

  textures.left1.rotate = groupD8.MIRROR_HORIZONTAL;
  textures.left2.rotate = groupD8.MIRROR_HORIZONTAL;

  app.stage = new Stage();

  let roomSize = 5;
  const hamiltonianBoard = new HamiltonianBoard(
    roomSize,
    roomSize,
  );

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

  const keysdown: Record<string, boolean> = {};

  let activeBoard = new ActiveHamiltonianBoard(
    hamiltonianBoard,
    textures,
    40,
    app,
    blur,
    lighting,
  );

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    if (activeBoard.finished && activeBoard.pos[0] === activeBoard.width + 1 && activeBoard.pos[1] === 0 && event.key === 'ArrowUp') {
      roomSize += 1;
      const newBoard = new HamiltonianBoard(
        roomSize,
        roomSize
      );
      app.stage.removeChild(activeBoard.room);
      app.stage.removeChild(lightingSprite);
      activeBoard = new ActiveHamiltonianBoard(
        newBoard,
        textures,
        40,
        app,
        blur,
        lighting,
      );
      app.stage.addChild(lightingSprite);
    }
    if (!activeBoard.currentOrigin && !activeBoard.currentDest) {
      activeBoard.handleKeys(keysdown);
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);

  lighting.position.x = app.screen.width / 2 - activeBoard.player.x;
  lighting.position.y = app.screen.height / 2 - activeBoard.player.y;

  let cycleCounter = 0;
  let waterCounter = 0;

  let animateCounter = 0;

  app.ticker.add((delta) => {
    activeBoard.room.position.x = app.screen.width / 2 - activeBoard.player.x;
    activeBoard.room.position.y = app.screen.height / 2 - activeBoard.player.y;

    lighting.position.x = app.screen.width / 2 - activeBoard.player.x;
    lighting.position.y = app.screen.height / 2 - activeBoard.player.y;

    activeBoard.tick(delta, keysdown);
  });
}

main();
