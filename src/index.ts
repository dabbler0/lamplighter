import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import HamiltonianBoard, { Direction, List } from './HamiltonianBoard';
import KnightGraph, { KnightColor, Knight } from './KnightGraph';

function nextColor(c: KnightColor) {
  if (c === KnightColor.red) {
    return KnightColor.green;
  } else if (c === KnightColor.green) {
    return KnightColor.blue;
  } else if (c === KnightColor.blue) {
    return KnightColor.red;
  }
}

enum Terrain {
  water = 'water',
  litTorch = 'litTorch',
  unlitTorch = 'unlitTorch',
  path = 'path',
}

type LevelOptions = {
  torchPuzzle?: boolean;
};

class KnightMob {
  trueColor: KnightColor;
  guessedColor: KnightColor;
  name: string;
  declarations: string[];
  enemies: string[];
  pos: [number, number];
  revealColor: boolean;

  constructor ({
    trueColor, name, declarations, pos,
    revealColor, enemies
  }: {
    trueColor: KnightColor;
    name: string;
    declarations: string[];
    revealColor: boolean;
    pos: [number, number];
    enemies: string[];
  }) {
    this.revealColor = revealColor;
    this.trueColor = trueColor;
    this.guessedColor = KnightColor.red;
    this.name = name;
    this.declarations = declarations;
    this.pos = pos;
    this.enemies = enemies;
  }
}

const knightTextureNames = {
  [KnightColor.red]: 'redKnight',
  [KnightColor.blue]: 'blueKnight',
  [KnightColor.green]: 'greenKnight',
};

type Mob = KnightMob;

function isPassable(t: Terrain) {
  return t !== Terrain.water;
}

function terrainToTexture(here: Terrain, above: Terrain, textures: Record<string, Texture>) {
  if (above === Terrain.water) {
    if (here === Terrain.unlitTorch) {
      return textures.lightTop;
    } else if (here === Terrain.litTorch) {
      return textures.litTop;
    } else if (here === Terrain.path) {
      return textures.stoneTop;
    } else {
      return [textures.water1, textures.water2, textures.water3, textures.water4][Math.floor(Math.random() * 4)];
    }
  } else {
    if (here === Terrain.unlitTorch) {
      return textures.lightMid;
    } else if (here === Terrain.litTorch) {
      return textures.litMid;
    } else if (here === Terrain.path) {
      return textures.stoneMid;
    } else {
      return textures.stoneUnder;
    }
  }
}

class ActiveBoard {
  // Terrain
  terrain: Terrain[][];
  tiles: Sprite[][];

  // Items on top of terrain
  mobs: { mob: Mob; sprite: Sprite }[];

  // Active puzzle things
  active: boolean;
  finished: boolean;

  // Player
  pos: [number, number];
  player: Sprite;
  playerTarget: [number, number];

  // Room container
  door: Sprite;
  room: Container;
  height: number;
  width: number;

  // Display text
  text: BitmapText;
  textScroll?: string[];
  textScrollIndex?: number;
  textWrapper: Container;

  // Particle decorations
  particles: { age: number; sprite: Graphics; vx: number; vy: number; }[];

  textures: Record<string, Texture>;

  // Rendering things
  app: Application;
  scale: number;
  blurFilter: Filter;
  lightingLayer: Layer;

  opts: LevelOptions;

  displayingText: boolean;

  constructor ({
    terrain,
    mobs,
    textures,
    scale,
    app,
    blurFilter,
    lightingLayer,
    opts,
  }: {
    terrain: Terrain[][];
    mobs: Mob[];
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
    opts: LevelOptions;
  }) {
    this.textures = textures;
    this.app = app;
    this.scale = scale;
    this.blurFilter = blurFilter;
    this.lightingLayer = lightingLayer;
    this.opts = opts;

    this.terrain = terrain;
    this.width = this.terrain.length;
    this.height = this.terrain[0].length;

    this.room = new Container();

    this.tiles = [];

    for (let i = 0; i < this.width; i++) {
      this.tiles[i] = [];
      for (let j = 0; j < this.height; j++) {
        const tile = new Sprite(
          terrainToTexture(
            this.terrain[i][j],
            j > 0 ? this.terrain[i][j - 1] : Terrain.water,
            textures
          )
        );

        if (this.terrain[i][j] === Terrain.litTorch) {
          this.addBulb(tile);
        }

        tile.scale.x = scale / 200;
        tile.scale.y = scale / 200;
        tile.position.x = i * scale;
        tile.position.y = j * scale;

        this.tiles[i][j] = tile;

        this.room.addChild(tile);
      }
    }

    // Add mobs on top of tiles
    this.mobs = [];

    mobs.forEach((mob) => {
      if (mob instanceof KnightMob) {
        const sprite = new Sprite(
          textures[
            knightTextureNames[
              mob.guessedColor
            ]
          ]
        );

        sprite.scale.x = this.scale / 200;
        sprite.scale.y = this.scale / 200;

        sprite.anchor.y = 0.3;

        sprite.position.x = mob.pos[0] * scale;
        sprite.position.y = mob.pos[1] * scale;

        this.room.addChild(sprite);
        this.mobs.push({
          mob, sprite
        });
      }
    });


    this.door = new Sprite(this.textures.door);
    this.room.addChild(this.door);
    this.door.position.x = Math.floor(this.width / 2) * this.scale;
    this.door.position.y = -this.scale;

    this.door.scale.x = this.scale / 200;
    this.door.scale.y = this.scale / 200;

    this.player = new Sprite(
      textures.face
    );

    this.player.anchor.y = 0.3;

    this.player.scale.x = scale / 200;
    this.player.scale.y = scale / 200;

    this.pos = [
      Math.floor(this.width / 2),
      this.height - 1
    ];
    this.playerTarget = [
      this.pos[0],
      this.pos[1] - 1
    ];

    this.room.addChild(this.player);

    this.player.position.x = this.pos[0] * scale;
    this.player.position.y = this.pos[1] * scale;

    this.active = true;

    this.finished = false;

    this.particles = [];

    this.app.stage.addChild(this.room);

    this.text = new BitmapText('', { fontName: 'TitleFont' });

    this.text.position.x = 15;
    this.text.position.y = 15;

    const textWrapperTexture = new Graphics();
    textWrapperTexture.beginFill(0xa0c0f0, 1);
    textWrapperTexture.drawRect(0, 0, this.app.screen.width, 110);
    textWrapperTexture.beginFill(0x303050, 1);
    textWrapperTexture.drawRect(5, 5, this.app.screen.width - 10, 100);

    this.textWrapper = new Container();
    this.textWrapper.alpha = 0.8;
    this.textWrapper.visible = false;
    const background = new Sprite(this.app.renderer.generateTexture(textWrapperTexture));
    this.textWrapper.addChild(background);
    this.textWrapper.addChild(this.text); 
  }

  static fromKnightGraph(knightGraph: KnightGraph, rest: {
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
  }) {
    const size = Object.keys(knightGraph.knights).length;

    const width = Math.ceil(Math.sqrt(size));
    const height = Math.ceil(Math.sqrt(size));

    const mobs: Mob[] = [];

    const terrain: Terrain[][] = [];

    for (let i = 0; i < width * 2 + 3; i++) {
      terrain[i] = [];
      for (let j = 0; j < height * 2 + 3; j++) {
        terrain[i][j] = Terrain.path;
      }
    }

    for (let i = 0; i < width * 2 + 1; i++) {
      terrain[i + 1][height * 2 + 1] = Terrain.water;
      terrain[i + 1][1] = Terrain.water;
    }
    for (let j = 0; j < height * 2 + 1; j++) {
      terrain[width * 2 + 1][j + 1] = Terrain.water;
      terrain[1][j + 1] = Terrain.water;
    }

    for (let i = 0; i < width - 1; i++) {
      for (let j = 0; j < height - 1; j++) {
        terrain[i * 2 + 3][j * 2 + 3] = Terrain.litTorch;
      }
    }

    terrain[width + 1][height * 2 + 1] = Terrain.path;
    terrain[1][1] = Terrain.litTorch;
    terrain[1][height * 2 + 1] = Terrain.litTorch;
    terrain[width * 2 + 1][1] = Terrain.litTorch;
    terrain[width * 2 + 1][height * 2 + 1] = Terrain.litTorch;

    const rendering = knightGraph.render();

    let index = 0;
    const taken = new Set<number>([width * (height - 1) + (width - 1) / 2]);

    Object.keys(rendering).forEach((name) => {
      mobs.push(new KnightMob({
        trueColor: knightGraph.knights[name].color,
        name,
        declarations: rendering[name],
        pos: [(index % width) * 2 + 2, Math.floor(index / width) * 2 + 2],
        enemies: Array.from(knightGraph.knights[name].enemies),
        revealColor: false,
      }));
      taken.add(index);
      const skip = Math.floor(Math.random() * (width * height - taken.size));
      console.log('adding skip', index, skip);
      for (let i = 0; i < skip + 1; i++) {
        index = (index + 1) % (width * height);
        while (taken.has(index)) {
          index = (index + 1) % (width * height);
        }
      }
    });

    // Pick random mob
    const king = mobs[Math.floor(Math.random() * mobs.length)];
    king.revealColor = true;
    king.guessedColor = king.trueColor;

    const queenName = king.enemies[Math.floor(Math.random() * king.enemies.length)];
    const queen = mobs.find((mob) => mob.name === queenName);
    queen.revealColor = true;
    queen.guessedColor = queen.trueColor;

    return new this({
      terrain,
      mobs,
      opts: {},
      ...rest
    });
  }

  static fromHamiltonian(hamiltonianBoard: HamiltonianBoard, rest: {
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
  }) {
    const { width, height } = hamiltonianBoard;

    const terrain: Terrain[][] = [];

    for (let i = 0; i < width * 2 + 3; i++) {
      terrain[i] = [];
      for (let j = 0; j < height * 2 + 3; j++) {
        terrain[i][j] = Terrain.water;
      }
    }

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        terrain[i * 2 + 2][j * 2 + 2] = Terrain.path;
      }
    }

    for (let cursor = hamiltonianBoard.goldPath; !!cursor; cursor = cursor.prev) {
      const [i, j] = cursor.head;

      if (hamiltonianBoard.degree(...cursor.head) >= 3) {
        terrain[i * 2 + 2][j * 2 + 2] = Terrain.unlitTorch;
      }
    }

    terrain[2][2] = Terrain.litTorch;

    Array.from(hamiltonianBoard.edges).forEach((edge) => {
      const [
        [i1, j1],
        [i2, j2]
      ] = edge.split('::').map((x) => x.split(':').map(Number));

      terrain[i1 + i2 + 2][j1 + j2 + 2] = Terrain.path;
    });

    for (let i = 0; i < width * 2 + 3; i++) {
      terrain[0][i] = Terrain.path;
      terrain[height * 2 + 2][i] = Terrain.path;
    }

    for (let i = 0; i < height * 2 + 3; i++) {
      terrain[i][0] = Terrain.path;
      terrain[i][width * 2 + 2] = Terrain.path;
    }

    terrain[2][1] = Terrain.path;

    return new this({
      terrain,
      mobs: [],
      opts: { torchPuzzle: true },
      ...rest
    });
  }

  isPassable (i: number, j: number) {
    return isPassable(this.terrain[i][j]) && this.mobs.every(({ mob }) =>
      mob.pos[0] !== i || mob.pos[1] !== j
    );
  }

  displayText (lines: string[]) {
    this.textScroll = lines;
    this.textScrollIndex = 0;
    this.text.text = lines.slice(this.textScrollIndex, this.textScrollIndex + 3).
        join('\n\r');
    this.textWrapper.visible = true;
    this.displayingText = true;
  }

  removeText () {
    this.textScrollIndex += 3;
    if (!this.textScroll || !this.textScrollIndex) return;

    if (this.textScrollIndex >= this.textScroll.length) {
      this.textWrapper.visible = false;
      this.displayingText = false;
    } else {
      this.text.text = this.textScroll.slice(this.textScrollIndex, this.textScrollIndex + 3).
          join('\n\r');
    }
  }

  handleKeys (keysdown: Record<string, boolean>) {
    if (this.displayingText) {
      this.removeText();
      return;
    }
    const [i, j] = this.pos;
    if (i === 2 && j === 2) this.active = true;

    let moved = false;

    // Movement
    if (keysdown['ArrowRight']) {
      if (i < this.width - 1 && this.isPassable(i + 1, j)) {
        this.pos[0] += 1;
        moved = true;
      }
      this.playerTarget = [this.pos[0] + 1, this.pos[1]];

      if (![this.textures.right1, this.textures.right2].includes(this.player.texture)) {
        this.player.texture = this.textures.right1;
      }
    }
    else if (keysdown['ArrowLeft']) {
      if (i > 0 && this.isPassable(i - 1, j)) {
        this.pos[0] -= 1;
        moved = true;
      }
      this.playerTarget = [this.pos[0] - 1, this.pos[1]];

      if (![this.textures.left1, this.textures.left2].includes(this.player.texture)) {
        this.player.texture = this.textures.left1;
      }
    }
    else if (keysdown['ArrowUp']) {
      if (j > 0 && this.isPassable(i, j - 1)) {
        this.pos[1] -= 1;
        moved = true;
      }
      this.playerTarget = [this.pos[0], this.pos[1] - 1];

      this.player.texture = this.textures.back;
    }
    else if (keysdown['ArrowDown']) {
      if (j < this.height - 1 && this.isPassable(i, j + 1)) {
        this.pos[1] += 1;
        moved = true;
      }
      this.playerTarget = [this.pos[0], this.pos[1] + 1];

      this.player.texture = this.textures.face;
    }
    else if (keysdown['w']) {
      const interacted = this.mobs.find(({ mob }) => mob.pos[0] === this.playerTarget[0] && mob.pos[1] === this.playerTarget[1]);
      if (interacted && !interacted.mob.revealColor) {
        const { mob, sprite } = interacted;
        mob.guessedColor = nextColor(mob.guessedColor);
        sprite.texture = this.textures[knightTextureNames[mob.guessedColor]];

        const knights = this.mobs.filter(({ mob }) => mob instanceof KnightMob);
        const knightsByName: Record<string, KnightMob> = {};
        knights.forEach((knight) => {
          knightsByName[knight.mob.name] = knight.mob;
        });

        if (knights.every(({ mob }) => mob.guessedColor === mob.trueColor)) this.declareFinished();
      }
    }
    else if (keysdown['q']) {
      const interacted = this.mobs.find(({ mob }) => mob.pos[0] === this.playerTarget[0] && mob.pos[1] === this.playerTarget[1]);
      if (interacted) {
        const { mob } = interacted;
        this.displayText([
          `I am ${mob.name}${mob.revealColor ? ` the ${mob.trueColor[0].toUpperCase() + mob.trueColor.substring(1)}` : ''}.`,
          ...mob.declarations
        ]);
      }
    }

    // Hamiltonian path puzzle
    if (
        this.opts.torchPuzzle &&
        moved &&
        this.terrain[this.pos[0]][this.pos[1]] === Terrain.litTorch &&
        !this.finished) {
      this.active = false;
      for (let oi = 0; oi < this.width; oi++) {
        for (let oj = 0; oj < this.height; oj++) {
          if (this.terrain[oi][oj] === Terrain.litTorch && !(oi === 2 && oj === 2)) {
            this.terrain[oi][oj] = Terrain.unlitTorch;
            this.tiles[oi][oj].texture = this.textures.lightMid;
            this.tiles[oi][oj].removeChild(this.tiles[oi][oj].children[0]);
          }
        }
      }
    }

    // Hamiltonian path puzzle
    if (this.opts.torchPuzzle && this.terrain[i][j] === Terrain.unlitTorch && this.active) {
      this.terrain[i][j] = Terrain.litTorch;

      // Finished?
      if (this.terrain.every((col) => col.every((cell) => cell !== Terrain.unlitTorch))) {
        this.declareFinished();
      }

      this.tiles[i][j].texture = this.textures.litMid;
      this.addBulb(this.tiles[i][j]);
    }

    this.player.position.x = this.pos[0] * this.scale;
    this.player.position.y = this.pos[1] * this.scale;
  }

  addBulb (sprite: Sprite) {
    const lightbulb = new Graphics();
    lightbulb.beginFill(0xddffdd, 0.5);
    lightbulb.drawCircle(0, 0, 500);
    lightbulb.endFill();
    (lightbulb as any).parentLayer = this.lightingLayer;
    lightbulb.position.x = 100;
    lightbulb.position.y = 100;
    lightbulb.filters = [this.blurFilter];
    sprite.addChild(lightbulb);
  }

  declareFinished () {
    this.finished = true;

    const doorbulb = new Graphics();
    doorbulb.beginFill(0xffffff, 0.7);
    doorbulb.drawCircle(0, 0, 500);
    doorbulb.endFill();
    doorbulb.position.x = 100;
    doorbulb.position.y = 100;
    (doorbulb as any).parentLayer = this.lightingLayer;
    doorbulb.filters = [this.blurFilter];

    this.door.addChild(doorbulb);
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
    this.textWrapper.position.y = this.app.screen.height - 110;

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        if (this.terrain[i][j] === Terrain.litTorch && Math.random() > Math.pow(0.5, delta * 0.025)) {
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
    redKnight: await Assets.load('./assets/red-knight.png'),
    blueKnight: await Assets.load('./assets/blue-knight.png'),
    greenKnight: await Assets.load('./assets/green-knight.png'),
  };

  textures.left1.rotate = groupD8.MIRROR_HORIZONTAL;
  textures.left2.rotate = groupD8.MIRROR_HORIZONTAL;

  app.stage = new Stage();

  let roomSize = 5;

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

  BitmapFont.from("TitleFont", {
    fill: "#ffffff",
    fontSize: 15,
    padding: 0,
    lineHeight: 15,
    fontWeight: 'bold',
  }, {
    chars: BitmapFont.ASCII
  });

  const keysdown: Record<string, boolean> = {};

  function generateHamiltonian (roomSize: number) {
    const newBoard = new HamiltonianBoard(
      roomSize,
      roomSize
    );
    return ActiveBoard.fromHamiltonian(
      newBoard,
      {
        textures,
        scale: 40,
        app,
        blurFilter: blur,
        lightingLayer: lighting,
      }
    );
  }

  function generateKnightGraph (roomSize: number) {
    const newBoard = new KnightGraph(
      Math.floor(roomSize / 2) - 1
    );
    return ActiveBoard.fromKnightGraph(
      newBoard,
      {
        textures,
        scale: 40,
        app,
        blurFilter: blur,
        lightingLayer: lighting,
      }
    );
  }

  let activeBoard = Math.random() < 0.5 ? generateKnightGraph(roomSize) : generateHamiltonian(roomSize);

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    if (activeBoard.finished &&
      activeBoard.pos[0] === Math.floor(activeBoard.width / 2) &&
      activeBoard.pos[1] === 0 &&
      event.key === 'ArrowUp') {

      roomSize += 1;
      app.stage.removeChild(activeBoard.room);
      app.stage.removeChild(activeBoard.textWrapper);
      app.stage.removeChild(lightingSprite);
      activeBoard = Math.random() < 0.5 ? generateKnightGraph(roomSize) : generateHamiltonian(roomSize);
      app.stage.addChild(lightingSprite);
      app.stage.addChild(activeBoard.textWrapper);
    }
    activeBoard.handleKeys(keysdown);
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);

  app.stage.addChild(activeBoard.textWrapper);

  lighting.position.x = app.screen.width / 2 - activeBoard.player.x;
  lighting.position.y = app.screen.height / 2 - activeBoard.player.y;

  app.ticker.add((delta) => {
    activeBoard.room.position.x = app.screen.width / 2 - activeBoard.player.x;
    activeBoard.room.position.y = app.screen.height / 2 - activeBoard.player.y;

    lighting.position.x = app.screen.width / 2 - activeBoard.player.x;
    lighting.position.y = app.screen.height / 2 - activeBoard.player.y;

    activeBoard.tick(delta, keysdown);
  });
}

main();

