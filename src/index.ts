import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites } from './Direction';
import List from './List';
import HamiltonianBoard from './HamiltonianBoard';
import GoishiHiroiBoard from './GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from './KnightGraph';
import AltarBoard from './AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob } from './BoardTemplate';

function nextColor(c: KnightColor) {
  if (c === KnightColor.red) {
    return KnightColor.green;
  } else if (c === KnightColor.green) {
    return KnightColor.blue;
  } else if (c === KnightColor.blue) {
    return KnightColor.red;
  }
}

const unlockedDoorTextureName = {
  [Direction.up]: 'stoneGo',
  [Direction.down]: 'stoneGoDown',
  [Direction.right]: 'stoneGoRight',
  [Direction.left]: 'stoneGoLeft',
};

enum BoardType {
  GoishiHiroi = 'GoishiHiroi',
  Hamiltonian = 'Hamiltonian',
  Altar = 'Altar'
};

const boardTypes = [
  BoardType.GoishiHiroi,
  BoardType.Hamiltonian,
  BoardType.Altar
];

// Memoized orb texture generator
const orbTextures: Record<number, Texture> = {};
function getOrbTexture(n: number, textures: Record<string, Texture>, app: Application) {
  if (n in orbTextures) return orbTextures[n];

  const container = new Container();
  for (let i = 0; i < Math.floor(n / 4); i++) {
    const sprite = new Sprite(textures.orbs4);
    sprite.position.y = i * -50;
    container.addChild(sprite);
  }

  if (n % 4 >= 2) {
    const twoSprite = new Sprite(textures.orbs2);
    twoSprite.position.y = Math.max(0, Math.floor(n / 4) - 1) * -50
    container.addChild(twoSprite);
  }
  if (n % 2 === 1) {
    const oneSprite = new Sprite(textures.orbs1);
    oneSprite.position.y = Math.max(0, Math.floor(n / 4) - 1) * -50
    container.addChild(oneSprite);
  }

  const renderTexture = RenderTexture.create({
    width: 200,
    height: 200 + 50 * Math.max(0, Math.floor(n / 4) - 1),
  });

  container.position.y = 50 * Math.max(0, Math.floor(n / 4) - 1);

  app.renderer.render(container, { renderTexture });

  orbTextures[n] = renderTexture;

  return renderTexture;
}

const knightTextureNames = {
  [KnightColor.red]: 'redKnight',
  [KnightColor.blue]: 'blueKnight',
  [KnightColor.green]: 'greenKnight',
};

function isPassable(t: Terrain) {
  return t !== Terrain.water;
}

function terrainToTexture(here: Terrain, above: Terrain, textures: Record<string, Texture>) {
  if (here === Terrain.ice) {
    return textures.ice;
  }
  if (here === Terrain.unusedIceRune) {
    return textures.unusedIceRune;
  }
  if (here === Terrain.usedIceRune) {
    return textures.usedIceRune;
  }
  if (here === Terrain.purple) {
    return textures.stonePurple;
  }
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
  pullingMob: { mob: Mob; sprite: Sprite };

  allDirs: Record<Direction, boolean>;
  startDir: Direction;

  // Room container
  doors: Record<Direction, Sprite>;
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
    startDir,
    allDirs,
  }: {
    terrain: Terrain[][];
    mobs: Mob[];
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
    opts: LevelOptions;
    startDir: Direction;
    allDirs: Record<Direction, boolean>;
  }) {
    this.startDir = startDir;
    this.allDirs = allDirs;
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

        if (this.terrain[i][j] === Terrain.litTorch || this.terrain[i][j] === Terrain.unusedIceRune) {
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

      if (mob instanceof AltarMob) {
        const sprite = new Sprite(
          textures[
            knightTextureNames.blue
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

      if (mob instanceof PileMob) {
        const sprite = new Sprite(
          getOrbTexture(mob.size, this.textures, this.app)
        );

        sprite.scale.x = this.scale / 200;
        sprite.scale.y = this.scale / 200;

        const excessHeight = (50 * Math.max(0, Math.floor(mob.size / 4) - 1));
        sprite.anchor.y = excessHeight / (200 + excessHeight);

        sprite.position.x = mob.pos[0] * scale;
        sprite.position.y = mob.pos[1] * scale;

        this.room.addChild(sprite);
        this.mobs.push({
          mob, sprite
        });
      }
    });

    const createDoor = (x: number, y: number, texture: Texture, visible: boolean) => {
      const door = new Sprite(texture);
      this.room.addChild(door);
      door.position.x = x * this.scale;
      door.position.y = y * this.scale;
      door.scale.x = this.scale / 200;
      door.scale.y = this.scale / 200;

      door.visible = visible;

      return door;
    }

    this.doors = {
      [Direction.up]: createDoor(Math.floor(this.width / 2), -1, this.textures.stoneStop, allDirs[Direction.up]),
      [Direction.down]: createDoor(Math.floor(this.width / 2), this.height, this.textures.stoneStopDown, allDirs[Direction.down]),
      [Direction.left]: createDoor(-1, Math.floor(this.height / 2), this.textures.stoneStopLeft, allDirs[Direction.left]),
      [Direction.right]: createDoor(this.width, Math.floor(this.height / 2), this.textures.stoneStopRight, allDirs[Direction.right]),
    };

    if (startDir) {
      this.addBulb(this.doors[startDir]);
      this.doors[startDir].texture = this.textures[unlockedDoorTextureName[startDir]]
    }

    this.player = new Sprite(
      textures.face
    );

    this.player.anchor.y = 0.3;

    this.player.scale.x = scale / 200;
    this.player.scale.y = scale / 200;

    this.pos = startDir === Direction.up ? 
      [
        Math.floor(this.width / 2),
        0
      ] :
      startDir === Direction.left ?
      [
        0,
        Math.floor(this.height / 2),
      ] :
      startDir == Direction.right ?
      [
        this.width - 1,
        Math.floor(this.height / 2),
      ] :
      [
        Math.floor(this.width / 2),
        this.height - 1,
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

  tryPush (i: number, j: number, di: number, dj: number) {
    if (!isPassable(this.terrain[i][j])) return false;
    if (!this.isPassable(di, dj)) return false;
    const foundMob = this.mobs.find(({ mob }) =>
      mob instanceof PileMob && mob.pos[0] === i && mob.pos[1] === j
    );

    if (!foundMob) return false;

    foundMob.mob.pos[0] = di;
    foundMob.mob.pos[1] = dj;

    foundMob.sprite.position.x = di * this.scale;
    foundMob.sprite.position.y = dj * this.scale;

    this.pos[0] = i;
    this.pos[1] = j;
    
    return true;
  }

  checkAltarVictory () {
    if (!this.opts.altarTarget) return;

    const finished = this.mobs.map(({ mob, sprite }) => {
      if (!(mob instanceof AltarMob)) return true;

      const nearby = this.mobs.filter(({ mob: pile }) => (pile instanceof PileMob) &&
        (Math.max(Math.abs(pile.pos[0] - mob.pos[0]), Math.abs(pile.pos[1] - mob.pos[1])) <= 1)
      ) as { mob: PileMob; sprite: Sprite }[];

      const sum = nearby.map(({ mob }) => mob.size).reduce((a, b) => a + b, 0);

      if (sum === this.opts.altarTarget) {
        for (let i = -1; i < 2; i++) {
          for (let j = -1; j < 2; j++) {
            if (this.terrain[mob.pos[0] + i][mob.pos[1] + j] === Terrain.unlitTorch) {
              this.lightTorch(mob.pos[0] + i, mob.pos[1] + j);
            }
          }
        }
        return true;
      } else {
        for (let i = -1; i < 2; i++) {
          for (let j = -1; j < 2; j++) {
            if (this.terrain[mob.pos[0] + i][mob.pos[1] + j] === Terrain.litTorch) {
              this.unlightTorch(mob.pos[0] + i, mob.pos[1] + j);
            }
          }
        }
        return false;
      }
    }).every((x) => x);

    if (finished) this.declareFinished();
  }

  tryMovePlayer (delta: [number, number]): boolean {
    const [oi, oj] = this.pos;
    const [i, j] = [this.pos[0] + delta[0], this.pos[1] + delta[1]];
    // May not go backward on ice
    if ([Terrain.ice, Terrain.usedIceRune].includes(this.terrain[this.pos[0]][this.pos[1]]) &&
        this.playerTarget[0] === this.pos[0] - delta[0] &&
        this.playerTarget[1] === this.pos[1] - delta[1]) {
      return false;
    }

    let moved = false;

    if (i >= 0 && i < this.width && j >= 0 && j < this.height) {
      if (this.isPassable(i, j)) {
        this.pos[0] = i;
        this.pos[1] = j;
  
        moved = true;
      } else {
        moved = this.tryPush(i, j, i + delta[0], j + delta[1]);

        if (moved) {
          this.checkAltarVictory();
        }
      }
    }
    if (moved && this.pullingMob) {
      this.pullingMob.mob.pos[0] = oi;
      this.pullingMob.mob.pos[1] = oj;
      this.pullingMob.sprite.x = oi * this.scale;
      this.pullingMob.sprite.y = oj * this.scale;
    }

    if (moved) {
      this.playerTarget = [i + delta[0], j + delta[1]];
    } else {
      this.playerTarget = [i, j];
    }
    if (moved && [Terrain.ice, Terrain.usedIceRune].includes(this.terrain[this.pos[0]][this.pos[1]])) {
      return this.tryMovePlayer(delta);
    }

    this.player.texture = (
      delta[0] === 1 ? this.textures.right1 :
      delta[0] === -1 ? this.textures.left1 :
      delta[1] === -1 ? this.textures.back :
      this.textures.face
    );

    return moved;
  }

  handleKeys (keysdown: Record<string, boolean>) {
    if (this.displayingText) {
      this.removeText();
      return;
    }
    const [i, j] = this.pos;
    if (this.opts.hRoot && i === this.opts.hRoot[0] && j === this.opts.hRoot[1]) this.active = true;

    let moved = false;

    // Movement
    if (keysdown['ArrowRight']) {
      moved = this.tryMovePlayer([1, 0]);
    }
    else if (keysdown['ArrowLeft']) {
      moved = this.tryMovePlayer([-1, 0]);
    }
    else if (keysdown['ArrowUp']) {
      moved = this.tryMovePlayer([0, -1]);
    }
    else if (keysdown['ArrowDown']) {
      moved = this.tryMovePlayer([0, 1]);
    }
    else if (keysdown['w']) {
      if (this.pullingMob) {
        this.pullingMob = null;
      } else {
        const interacted = this.mobs.find(({ mob }) => mob.pos[0] === this.playerTarget[0] && mob.pos[1] === this.playerTarget[1]);
        if (interacted) {
          if (interacted.mob instanceof KnightMob && !interacted.mob.revealColor && !this.finished) {
            const { mob, sprite } = interacted;
            mob.guessedColor = nextColor(mob.guessedColor);
            sprite.texture = this.textures[knightTextureNames[mob.guessedColor]];

            const knights = this.mobs.filter(({ mob }) => mob instanceof KnightMob) as { mob: KnightMob; sprite: Sprite }[];
            const knightsByName: Record<string, KnightMob> = {};
            knights.forEach((knight) => {
              knightsByName[knight.mob.name] = knight.mob;
            });

            if (knights.every(({ mob }) => mob.guessedColor === mob.trueColor)) this.declareFinished();
          } else if (interacted.mob instanceof PileMob) {
            this.pullingMob = interacted;
          }
        }
      }
    }
    else if (keysdown['q']) {
      const interacted = this.mobs.find(({ mob }) => mob.pos[0] === this.playerTarget[0] && mob.pos[1] === this.playerTarget[1]);
      if (interacted) {
        const { mob } = interacted;
        if (mob instanceof KnightMob) {
          this.displayText([
            `I am ${mob.name}${mob.revealColor ? ` the ${mob.trueColor[0].toUpperCase() + mob.trueColor.substring(1)}` : ''}.`,
            ...mob.declarations
          ]);
        }
      }
    }

    // Hamiltonian path puzzle
    if (
        this.opts.hRoot &&
        moved &&
        this.terrain[this.pos[0]][this.pos[1]] === Terrain.litTorch &&
        !this.finished) {
      this.active = false;
      for (let oi = 0; oi < this.width; oi++) {
        for (let oj = 0; oj < this.height; oj++) {
          if (this.terrain[oi][oj] === Terrain.litTorch && !(oi === this.opts.hRoot[0] && oj === this.opts.hRoot[1])) {
            this.unlightTorch(oi, oj);
          }
        }
      }
    }

    const [ni, nj] = this.pos;

    // Goishi Hiroi puzzle
    if (this.terrain[ni][nj] === Terrain.unusedIceRune) {
      this.terrain[ni][nj] = Terrain.usedIceRune;
      this.tiles[ni][nj].texture = this.textures.usedIceRune;
      this.tiles[ni][nj].removeChild(this.tiles[ni][nj].children[0]);

      if (this.terrain.every((col) => col.every((cell) => cell !== Terrain.unusedIceRune))) {
        this.declareFinished();
      }
    } else if (this.terrain[ni][nj] === Terrain.path && !this.finished) {
      for (let oi = 0; oi < this.width; oi++) {
        for (let oj = 0; oj < this.height; oj++) {
          if (this.terrain[oi][oj] === Terrain.usedIceRune) {
            this.terrain[oi][oj] = Terrain.unusedIceRune;
            this.tiles[oi][oj].texture = this.textures.unusedIceRune;
            this.addBulb(this.tiles[oi][oj]);
          }
        }
      }
    }

    // Hamiltonian path puzzle
    if (this.opts.hRoot && this.terrain[i][j] === Terrain.unlitTorch && this.active) {
      this.lightTorch(i, j);

      // Finished?
      if (this.terrain.every((col) => col.every((cell) => cell !== Terrain.unlitTorch))) {
        this.declareFinished();
      }
    }

    this.player.position.x = this.pos[0] * this.scale;
    this.player.position.y = this.pos[1] * this.scale;
  }

  lightTorch (i: number, j: number) {
    if (this.terrain[i][j] === Terrain.unlitTorch) {
      this.terrain[i][j] = Terrain.litTorch;

      this.tiles[i][j].texture = this.textures.litMid;
      this.addBulb(this.tiles[i][j]);
    }
  }

  unlightTorch (i: number, j: number) {
    if (this.terrain[i][j] === Terrain.litTorch) {
      this.terrain[i][j] = Terrain.unlitTorch;
      this.tiles[i][j].texture = this.textures.lightMid;
      this.tiles[i][j].removeChild(this.tiles[i][j].children[0]);
    }
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

    (Object.keys(this.doors) as Direction[]).forEach((key) => {
      if (this.allDirs[key] && key !== this.startDir) {
        this.doors[key].texture = this.textures[unlockedDoorTextureName[key]];
        this.addBulb(this.doors[key]);
      }
    });
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
        if ((this.terrain[i][j] === Terrain.litTorch || this.terrain[i][j] === Terrain.unusedIceRune) && Math.random() > Math.pow(0.5, delta * 0.025)) {
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

class PossibleBoard {
  constructor (
    public pos: [number, number],
    public dim: [number, number],
    public level: number,
    public type: BoardType,
  ) {
  }

  intersects (other: PossibleBoard) {
    return !(
      other.pos[0] > this.pos[0] + this.dim[0] ||
      this.pos[0] > other.pos[0] + other.dim[0] ||
      other.pos[1] > this.pos[1] + this.dim[1] ||
      this.pos[1] > other.pos[1] + other.dim[1]
    );
  }
}

class UnreifiedBoard extends PossibleBoard {
  pos: [number, number];
  dim: [number, number];
  template: BoardTemplate;
  level: number;
  type: BoardType;

  constructor ({
    pos, template,
    level, type,
  }: {
    pos: [number, number];
    template: BoardTemplate;
    level: number;
    type: BoardType;
  }) {
    super(pos,
      [template.terrain.length, template.terrain[0].length],
      level,
      type,
    );
    this.template = template;
  }
}

class ReifiedBoard extends PossibleBoard {
  pos: [number, number];
  dim: [number, number];
  board: ActiveBoard;
  exits: Record<Direction, PossibleBoard | null>;
  startDir: Direction;
  level: number;
  type: BoardType;

  constructor ({
    pos, board, startDir,
    exits, level, type,
  }: {
    pos: [number, number];
    board: ActiveBoard;
    startDir: Direction;
    exits: Record<Direction, PossibleBoard | null>;
    level: number;
    type: BoardType;
  }) {
    super(pos,
      [board.width, board.height],
      level,
      type
    );
    this.startDir = startDir;
    this.board = board;
    this.exits = exits;
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
    stoneGo: await Assets.load('./assets/stone-go.png'),
    stoneGoDown: await Assets.load('./assets/stone-go-down.png'),
    stoneGoRight: await Assets.load('./assets/stone-go-right.png'),
    stoneGoLeft: await Assets.load('./assets/stone-go-left.png'),
    stoneStop: await Assets.load('./assets/stone-stop.png'),
    stoneStopDown: await Assets.load('./assets/stone-stop-down.png'),
    stoneStopLeft: await Assets.load('./assets/stone-stop-left.png'),
    stoneStopRight: await Assets.load('./assets/stone-stop-right.png'),
    stonePurple: await Assets.load('./assets/stone-purple.png'),
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
    ice: await Assets.load('./assets/ice.png'),
    unusedIceRune: await Assets.load('./assets/ice-rune-unused.png'),
    usedIceRune: await Assets.load('./assets/ice-rune-used.png'),
    orbs4: await Assets.load('./assets/orbs-4.png'),
    orbs2: await Assets.load('./assets/orbs-2.png'),
    orbs1: await Assets.load('./assets/orbs-1.png'),
  };

  textures.left1.rotate = groupD8.MIRROR_HORIZONTAL;
  textures.left2.rotate = groupD8.MIRROR_HORIZONTAL;

  app.stage = new Stage();

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

  function generateHamiltonian (roomLevel: number) {
    const newBoard = new HamiltonianBoard(
      Math.floor(Math.sqrt(5 * roomLevel + 4)),
      Math.floor(Math.sqrt(5 * roomLevel + 4))
    );
    return BoardTemplate.fromHamiltonian(newBoard);
  }

  function generateKnightGraph (roomLevel: number) {
    const newBoard = new KnightGraph(
      Math.ceil((roomLevel - 5) / 10)
    );
    return BoardTemplate.fromKnightGraph(newBoard);
  }
  function generateGoishiHiroi (roomLevel: number) {
    const newBoard = new GoishiHiroiBoard(
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      roomLevel,
    );
    return BoardTemplate.fromGoishiHiroi(newBoard);
  }

  function generateAltar (roomLevel: number) {
    const newBoard = new AltarBoard(
      Math.ceil(roomLevel / 3)
    );
    return BoardTemplate.fromAltar(newBoard);
  }

  function generateTemplate (level: number, exclude: BoardType) {
    const candidates = boardTypes.filter((x) => x !== exclude);
    const selection = candidates[Math.floor(Math.random() * candidates.length)];
    const template = 
      selection === BoardType.GoishiHiroi ? generateGoishiHiroi(level) :
      selection === BoardType.Hamiltonian ? generateHamiltonian(level)
      : generateAltar(level);

    return { template, type: selection };
  }

  let rooms: PossibleBoard[] = []

  function placeTemplate (initial: PossibleBoard, dir: Direction, template: BoardTemplate): [number, number] {
    if (dir === Direction.left) {
      return [
        initial.pos[0] - template.width() - 1,
        initial.pos[1] + Math.floor(initial.dim[1] / 2) - Math.floor(template.height() / 2)
      ];
    } else if (dir === Direction.right) {
      return [
        initial.pos[0] + initial.dim[1] + 1,
        initial.pos[1] + Math.floor(initial.dim[1] / 2) - Math.floor(template.height() / 2)
      ];
    } else if (dir === Direction.up) {
      return [
        initial.pos[0] + Math.floor(initial.dim[0] / 2) - Math.floor(template.height() / 2),
        initial.pos[1] - template.height() - 1,
      ];
    } else if (dir === Direction.down) {
      return [
        initial.pos[0] + Math.floor(initial.dim[0] / 2) - Math.floor(template.height() / 2),
        initial.pos[1] + initial.dim[1] + 1,
      ];
    }
  }

  function reify (board: UnreifiedBoard, startDir?: Direction, prev?: ReifiedBoard) {
    const exits: Record<Direction, PossibleBoard | null> = {
      [Direction.left]: null,
      [Direction.right]: null,
      [Direction.up]: null,
      [Direction.down]: null,
    };
    (Object.values(Direction) as Direction[]).forEach((dir) => {
      if (dir === startDir) {
        exits[dir] = prev;
      } else {
        const { template, type } = generateTemplate(board.level + 1, board.type);
        const candidate = new UnreifiedBoard({
          template,
          level: board.level + 1,
          pos: placeTemplate(board, dir, template),
          type
        });

        if (rooms.every((room) => !room.intersects(candidate))) {
          rooms.push(candidate);
          exits[dir] = candidate;
        }
      }
    });

    const result = new ReifiedBoard({
      pos: board.pos,
      board: new ActiveBoard({
        ...board.template,
        textures,
        scale: 40,
        app,
        blurFilter: blur,
        lightingLayer: lighting,
        startDir,
        allDirs: {
          [Direction.left]: !!exits[Direction.left],
          [Direction.right]: !!exits[Direction.right],
          [Direction.up]: !!exits[Direction.up],
          [Direction.down]: !!exits[Direction.down],
        }
      }),
      level: board.level,
      type: board.type,
      startDir,
      exits,
    });

    rooms = rooms.filter((x) => x !== board);
    rooms.push(result);

    return result;
  }

  const { template, type } = generateTemplate(1, BoardType.GoishiHiroi);
  const preActiveBoard = new UnreifiedBoard({
    pos: [0, 0],
    level: 1,
    template,
    type
  });

  rooms.push(preActiveBoard);
  let activeBoard: ReifiedBoard = reify(preActiveBoard);

  app.stage.addChild(activeBoard.board.room);
  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);

  app.stage.addChild(activeBoard.board.textWrapper);

  function isAtDoor(dir: Direction) {
    if (dir === Direction.up) {
      return activeBoard.board.pos[0] === Math.floor(activeBoard.board.width / 2) &&
        activeBoard.board.pos[1] === 0;
    } else if (dir === Direction.down) {
      return activeBoard.board.pos[0] === Math.floor(activeBoard.board.width / 2) &&
        activeBoard.board.pos[1] === activeBoard.board.height - 1;
    } else if (dir === Direction.right) {
      return activeBoard.board.pos[1] === Math.floor(activeBoard.board.height / 2) &&
        activeBoard.board.pos[0] === activeBoard.board.width - 1;
    } else if (dir === Direction.left) {
      return activeBoard.board.pos[1] === Math.floor(activeBoard.board.height / 2) &&
        activeBoard.board.pos[0] === 0;
    }
  }

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    const keyMap = {
      [Direction.up]: 'ArrowUp',
      [Direction.down]: 'ArrowDown',
      [Direction.right]: 'ArrowRight',
      [Direction.left]: 'ArrowLeft',
    };

    const exited = (Object.keys(keyMap) as Direction[]).map((key) => {
      console.log('testing', key, keyMap[key], event.key, isAtDoor(key), activeBoard.startDir, activeBoard.board.finished, activeBoard.board.pos);
      if ((activeBoard.startDir === key || activeBoard.board.finished) && isAtDoor(key) && keyMap[key] === event.key) {
        const exit = activeBoard.exits[key];
        if (!exit) return false;

        app.stage.removeChild(activeBoard.board.room);
        app.stage.removeChild(activeBoard.board.textWrapper);
        app.stage.removeChild(lightingSprite);

        if (exit instanceof UnreifiedBoard) {
          const newBoard = reify(exit, opposites[key], activeBoard);
          activeBoard.exits[key] = newBoard;
          activeBoard = newBoard;
        }
        else if (exit instanceof ReifiedBoard) {
          activeBoard = exit;
        }
        app.stage.addChild(activeBoard.board.room);
        app.stage.addChild(lightingSprite);
        app.stage.addChild(activeBoard.board.textWrapper);

        return true;
      }
    }).some((x) => x);

    if (!exited) {
      activeBoard.board.handleKeys(keysdown);
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  lighting.position.x = app.screen.width / 2 - activeBoard.board.player.x;
  lighting.position.y = app.screen.height / 2 - activeBoard.board.player.y;

  app.ticker.add((delta) => {
    activeBoard.board.room.position.x = app.screen.width / 2 - activeBoard.board.player.x;
    activeBoard.board.room.position.y = app.screen.height / 2 - activeBoard.board.player.y;

    lighting.position.x = app.screen.width / 2 - activeBoard.board.player.x;
    lighting.position.y = app.screen.height / 2 - activeBoard.board.player.y;

    activeBoard.board.tick(delta, keysdown);
  });
}

main();
