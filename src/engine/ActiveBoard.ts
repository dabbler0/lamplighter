import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites } from '../util/Direction';
import List from '../util/List';
import HamiltonianBoard from '../generators/HamiltonianBoard';
import GoishiHiroiBoard from '../generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from '../generators/KnightGraph';
import AltarBoard from '../generators/AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LockerMob, ChestMob, LevelOptions, AltarMob, PileMob } from './BoardTemplate';

export class PlayerState {
  keys: Set<string>;

  constructor () {
    this.keys = new Set();
  }
}

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
  if (here === Terrain.grass) {
    return textures.grass;
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

export default class ActiveBoard {
  // Terrain
  terrain: Terrain[][];
  tiles: Sprite[][];

  // Items on top of terrain
  mobs: { mob: Mob; sprite: Sprite }[];

  // Active puzzle things
  active: boolean = false;
  finished: boolean = false;
  pathSprites: Graphics[] = [];

  // Player
  pos: [number, number];
  player: Sprite;
  playerTarget: [number, number];
  pullingMob: { mob: Mob; sprite: Sprite };

  // Animation
  animationCounter: number = 0;
  pendingAnimations: { sprite: Sprite; start: [number, number]; vector: [number, number]; }[] | null = null;
  animationOvershoot: boolean = false;
  animationParticleEffect: boolean = false;
  animationAwaiters: (() => void)[] = [];
  animationSpeed: number = 0.15;

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
  particles: { age: number; sprite: Graphics; vx: number; vy: number; }[] = [];

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

      if (mob instanceof ChestMob) {
        const sprite = new Sprite(
          textures.chestClosed
        );

        sprite.scale.x = this.scale / 200;
        sprite.scale.y = this.scale / 200;

        sprite.anchor.y = 0.3;

        sprite.position.x = mob.pos[0] * scale;
        sprite.position.y = mob.pos[1] * scale;

        this.room.addChild(sprite);
        this.addBulb(sprite);
        this.mobs.push({
          mob, sprite
        });
      }

      if (mob instanceof LockerMob) {
        const sprite = new Sprite(
          textures.blueKnight
        );

        sprite.scale.x = this.scale / 200;
        sprite.scale.y = this.scale / 200;

        sprite.anchor.y = 0.3;

        sprite.position.x = mob.pos[0] * scale;
        sprite.position.y = mob.pos[1] * scale;

        this.room.addChild(sprite);
        this.addBulb(sprite);
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

    if (this.opts.autoFinish) this.declareFinished();
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

  async tryPush (i: number, j: number, di: number, dj: number) {
    const [oi, oj] = this.pos;

    if (!isPassable(this.terrain[i][j])) return false;
    if (!this.isPassable(di, dj)) return false;
    const foundMob = this.mobs.find(({ mob }) =>
      mob instanceof PileMob && mob.pos[0] === i && mob.pos[1] === j
    );

    if (!foundMob) return false;

    foundMob.mob.pos[0] = di;
    foundMob.mob.pos[1] = dj;


    this.pos[0] = i;
    this.pos[1] = j;

    this.pendingAnimations = [
      {
        sprite: this.player,
        start: [this.player.position.x, this.player.position.y],
        vector: [(i - oi) * this.scale, (j - oj) * this.scale]
      },
      {
        sprite: foundMob.sprite,
        start: [foundMob.sprite.position.x, foundMob.sprite.position.y],
        vector: [(di - i) * this.scale, (dj - j) * this.scale]
      },
    ];
    this.animationSpeed = 0.1;
    this.animationOvershoot = false;
    this.animationParticleEffect = false;

    await new Promise<void>((resolve) => {
      this.animationAwaiters.push(() => resolve());
    });
    
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

  async tryMovePlayer (delta: [number, number]): Promise<boolean> {
    const [oi, oj] = this.pos;
    const [i, j] = [this.pos[0] + delta[0], this.pos[1] + delta[1]];

    // May not go backward on ice
    if ([Terrain.ice, Terrain.usedIceRune].includes(this.terrain[this.pos[0]][this.pos[1]]) &&
        this.playerTarget[0] === this.pos[0] - delta[0] &&
        this.playerTarget[1] === this.pos[1] - delta[1]) {
      return false;
    }

    // Otherwise, at least turn
    this.player.texture = (
      delta[0] === 1 ? this.textures.right1 :
      delta[0] === -1 ? this.textures.left1 :
      delta[1] === -1 ? this.textures.back :
      this.textures.face
    );

    let moved = false;

    if (i >= 0 && i < this.width && j >= 0 && j < this.height) {
      if (this.isPassable(i, j)) {
        this.pos[0] = i;
        this.pos[1] = j;

        this.pendingAnimations = [
          {
            sprite: this.player,
            start: [this.player.position.x, this.player.position.y],
            vector: [(i - oi) * this.scale, (j - oj) * this.scale]
          }
        ];
        this.animationSpeed = 0.15;
        if ([Terrain.ice, Terrain.usedIceRune].includes(this.terrain[i][j])) {
          this.animationOvershoot = true;
          this.animationParticleEffect = true;
        } else {
          this.animationOvershoot = false;
          this.animationParticleEffect = false;
        }

        await new Promise<void>((resolve) => {
          this.animationAwaiters.push(() => resolve());
        });

        moved = true;
      } else {
        moved = await this.tryPush(i, j, i + delta[0], j + delta[1]);

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

    if (moved && this.active) {
      const tracker = new Graphics();
      tracker.beginFill(this.opts.hRoot ? 0x00ffaa : 0xffffff);
      if (oi === i) {
        tracker.drawRect(this.scale * (1 / 2 - 1 / 20), this.opts.hRoot ? -this.scale / 3 : 0, this.scale / 10, this.scale);
      } else {
        tracker.drawRect(0, this.scale * (1 / 2 - 1 / 20 - (this.opts.hRoot ? 1/3 : 0)), this.scale, this.scale / 10);
      }
      tracker.endFill();

      tracker.alpha = 0.3;

      tracker.position.x = (i + oi) / 2 * this.scale;
      tracker.position.y = (j + oj) / 2 * this.scale;
      this.pathSprites.push(tracker);
      this.room.addChild(tracker);
    }

    if (moved && [Terrain.ice, Terrain.usedIceRune].includes(this.terrain[this.pos[0]][this.pos[1]])) {
      return this.tryMovePlayer(delta);
    }

    return moved;
  }

  async handleKeys (keysdown: Record<string, boolean>, playerState: PlayerState) {
    if (this.displayingText) {
      this.removeText();
      return;
    }
    if (this.pendingAnimations) return;

    const [i, j] = this.pos;
    let moved = false;

    // Movement
    if (keysdown['ArrowRight']) {
      moved = await this.tryMovePlayer([1, 0]);
    }
    else if (keysdown['ArrowLeft']) {
      moved = await this.tryMovePlayer([-1, 0]);
    }
    else if (keysdown['ArrowUp']) {
      moved = await this.tryMovePlayer([0, -1]);
    }
    else if (keysdown['ArrowDown']) {
      moved = await this.tryMovePlayer([0, 1]);
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
          } else if (interacted.mob instanceof ChestMob && this.opts.keyProvided) {
            this.displayText([
              `Received the Key of ${this.opts.keyProvided}.`
            ]);
            playerState.keys.add(this.opts.keyProvided);
            interacted.sprite.texture = this.textures.chestOpen;
          } else if (interacted.mob instanceof LockerMob && this.opts.lockRequired) {
            if (this.finished) {
              this.displayText([
                `Thank you.`
              ]);
            } else if (playerState.keys.has(this.opts.lockRequired)) {
              this.displayText([
                `Thank you.`
              ]);
              playerState.keys.delete(this.opts.lockRequired);
              this.declareFinished();
            } else {
              this.displayText([
                `Bring me the Key of ${this.opts.lockRequired}.`
              ]);
            }
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
        } else if (interacted.mob instanceof LockerMob && this.opts.lockRequired) {
          if (this.finished) {
            this.displayText([
              `Thank you.`
            ]);
          } else {
            this.displayText([
              `Bring me the Key of ${this.opts.lockRequired}.`
            ]);
          }
        }
      }
    } else if (keysdown['i']) {
      this.displayText([
        "You are carrying:",
        ...Array.from(playerState.keys).map((key) => `The Key of ${key}`)
      ]);
    }

    // Hamiltonian path puzzle
    if (moved && this.opts.hRoot && this.pos[0] === this.opts.hRoot[0] && this.pos[1] === this.opts.hRoot[1] && !this.finished) {
      this.active = true;

      // Finished?
      if (this.terrain.every((col) => col.every((cell) => cell !== Terrain.unlitTorch))) {
        this.declareFinished();
      } else {
        this.pathSprites.forEach((sprite) => this.room.removeChild(sprite));
        this.pathSprites = [];

        for (let oi = 0; oi < this.width; oi++) {
          for (let oj = 0; oj < this.height; oj++) {
            if (this.terrain[oi][oj] === Terrain.litTorch && !(oi === this.opts.hRoot[0] && oj === this.opts.hRoot[1])) {
              this.unlightTorch(oi, oj);
            }
          }
        }
      }
    }

    // Hamiltonian path puzzle
    else if (
        this.opts.hRoot &&
        moved &&
        this.terrain[this.pos[0]][this.pos[1]] === Terrain.litTorch &&
        !this.finished) {
      this.active = false;
      this.pathSprites.forEach((sprite) => this.room.removeChild(sprite));
      this.pathSprites = [];

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
    if (this.opts.goishiHiroi) {
      if (this.terrain[ni][nj] === Terrain.unusedIceRune) {
        if (!this.active) this.active = true;
        this.terrain[ni][nj] = Terrain.usedIceRune;
        this.tiles[ni][nj].texture = this.textures.usedIceRune;
        this.tiles[ni][nj].removeChild(this.tiles[ni][nj].children[0]);

        if (this.terrain.every((col) => col.every((cell) => cell !== Terrain.unusedIceRune))) {
          this.declareFinished();
        }
      } else if (this.terrain[ni][nj] === Terrain.path && !this.finished) {
        this.active = false;
        this.pathSprites.forEach((sprite) => this.room.removeChild(sprite));
        this.pathSprites = [];
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
    }


    // Hamiltonian path puzzle
    if (moved && this.opts.hRoot && this.terrain[this.pos[0]][this.pos[1]] === Terrain.unlitTorch && this.active) {
      this.lightTorch(this.pos[0], this.pos[1]);
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
    if (this.finished) return;

    this.finished = true;
    this.active = false;

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.width; j++) {
        if (this.terrain[i][j] === Terrain.usedIceRune) {
          this.addBulb(this.tiles[i][j]);
        }
      }
    }

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
    sprite.position.x = i;
    sprite.position.y = j;
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

    if (this.pendingAnimations) {
      this.animationCounter += delta * this.animationSpeed;

      const resultPosition = this.animationOvershoot ? this.animationCounter : Math.min(this.animationCounter, 1);

      this.pendingAnimations.forEach(({ sprite, start, vector }) => {
        if (this.animationParticleEffect) {
          this.addParticle(
            start[0] + vector[0] * resultPosition + this.scale / 2,
            start[1] + vector[1] * resultPosition + this.scale * 0.7,
          )
        }
        sprite.position.x = start[0] + vector[0] * resultPosition;
        sprite.position.y = start[1] + vector[1] * resultPosition;
      });

      if (this.animationCounter >= 1) {
        this.pendingAnimations = null;
        this.animationCounter = this.animationCounter % 1;
        this.animationAwaiters.forEach((fn) => fn());
        this.animationAwaiters = [];
      }
    }

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        if ((this.terrain[i][j] === Terrain.litTorch || this.terrain[i][j] === Terrain.unusedIceRune || this.terrain[i][j] === Terrain.usedIceRune && this.finished) && Math.random() > Math.pow(0.5, delta * 0.025)) {
          this.addParticle(i * this.scale + this.scale / 2, j * this.scale + 3);
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
