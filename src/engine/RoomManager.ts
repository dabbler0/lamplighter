import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { add, opposites } from '../util/Direction';
import List from '../util/List';
import HamiltonianBoard from '../generators/HamiltonianBoard';
import GoishiHiroiBoard from '../generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from '../generators/KnightGraph';
import AltarBoard from '../generators/AltarBoard';
import BoardTemplate, { BoardType, Terrain, Mob, KnightMob, LockerMob, ChestMob, LevelOptions, AltarMob, PileMob } from './BoardTemplate';
import Tile from './Tile';
import RenderContext from './RenderContext';
import PossibleBoard from './PossibleBoard';

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
    } else if (here === Terrain.litTorch || here === Terrain.sourceTorch) {
      return textures.litTop;
    } else if (here === Terrain.path) {
      return textures.stoneTop;
    } else {
      return [textures.water1, textures.water2, textures.water3, textures.water4][Math.floor(Math.random() * 4)];
    }
  } else {
    if (here === Terrain.unlitTorch) {
      return textures.lightMid;
    } else if (here === Terrain.litTorch || here === Terrain.sourceTorch) {
      return textures.litMid;
    } else if (here === Terrain.path) {
      return textures.stoneMid;
    } else {
      return textures.stoneUnder;
    }
  }
}

export default class RoomManager {
  tiles: Record<string, Tile> = {};
  template: BoardTemplate;
  context: RenderContext;
  finished: boolean;

  constructor ({ room, context, finished }: {
    room: PossibleBoard,
    context: RenderContext,
    finished: boolean,
  }) {
    const { template, pos, startDir, exits } = room;
    const { terrain, mobs } = template;
    this.finished = finished;

    const mobMap: Record<string, Mob> = {};
    mobs.forEach((mob) => mobMap[`${mob.pos[0]}:${mob.pos[1]}`] = mob);

    Object.keys(exits).forEach((d) => {
      if (!exits[d as Direction]) return;
      const i = (
        d === Direction.up || d === Direction.down
      ) ? Math.floor(template.width() / 2) : (
        d === Direction.left
      ) ? -1 :
      template.width();

      const j = (
        d === Direction.right || d === Direction.left
      ) ? Math.floor(template.height() / 2) : (
        d === Direction.up
      ) ? -1 :
      template.height();

      this.tiles[`${i + pos[0]}:${j + pos[1]}`] = new Tile({
        pos: [i + pos[0], j + pos[1]],
        context,
        terrain: (d === startDir || this.finished) ? Terrain.openDoor : Terrain.door,
        texture: (d === startDir || this.finished) ? context.textures.stoneGo : context.textures.stoneStop,
        bulb: d === startDir || this.finished,
        particles: false,
        visible: false,
      });

      this.tiles[`${i + pos[0]}:${j + pos[1]}`].init();
    });

    this.template = template;
    this.context = context;

    for (let i = 0; i < terrain.length; i++) {
      for (let j = 0; j < terrain[i].length; j++) {
        this.tiles[`${i + pos[0]}:${j + pos[1]}`] = new Tile({
          pos: [i + pos[0], j + pos[1]],
          context,
          terrain: terrain[i][j],
          texture: terrainToTexture(
            terrain[i][j],
            j > 0 ? terrain[i][j - 1] : Terrain.water,
            context.textures
          ),
          mob: mobMap[`${i}:${j}`],
          bulb: terrain[i][j] === Terrain.litTorch || terrain[i][j] === Terrain.sourceTorch || terrain[i][j] === Terrain.unusedIceRune,
          particles: terrain[i][j] === Terrain.litTorch,
          visible: false,
        });

        this.tiles[`${i + pos[0]}:${j + pos[1]}`].init();
      }
    }
  }

  reveal () {
    Object.values(this.tiles).forEach((tile) => tile.makeVisible());
  }

  static create({ room, context }: {
    room: PossibleBoard,
    context: RenderContext,
  }) {
    if (room.template.type === BoardType.Hamiltonian) {
      return new HamiltonianRoomManager({ room, context });
    }
    if (room.template.type === BoardType.GoishiHiroi) {
      return new GoishiHiroiRoomManager({ room, context });
    }
    if (room.template.type === BoardType.Altar) {
      return new AltarRoomManager({ room, context });
    }
    return new RoomManager({ room, context, finished: true });
  }

  declareFinished () {
    this.finished = true;

    Object.values(this.tiles).forEach((t) => {
      if (t.terrain === Terrain.door) {
        t.terrain = Terrain.openDoor;
        t.sprite.texture = this.context.textures.stoneGo;
        t.addBulb();
      }
    });
  }

  step (pos: [number, number], dir: Direction): { ok: boolean; slide?: Direction; mobTransfer?: { from: Tile, to: Tile } } {
    const tile = this.tiles[`${pos[0]}:${pos[1]}`];

    if (tile.terrain === Terrain.water || tile.terrain === Terrain.door) return { ok: false };
    return { ok: true };
  }
};

class HamiltonianRoomManager extends RoomManager {
  active = false;
  finished = false;

  constructor ({ room, context }: {
    room: PossibleBoard,
    context: RenderContext,
  }) {
    super({ room, context, finished: false });
  }

  step (pos: [number, number], dir: Direction) {
    const tile = this.tiles[`${pos[0]}:${pos[1]}`];

    if (tile.terrain === Terrain.water || tile.terrain === Terrain.door) return { ok: false };

    if (!this.finished) {
      if (this.active &&
          tile.terrain === Terrain.unlitTorch) {
        tile.terrain = Terrain.litTorch;
        tile.sprite.texture = this.context.textures.litMid;
        tile.addBulb();
      }
      else if (this.active &&
          tile.terrain === Terrain.litTorch) {
        this.active = false;
        Object.values(this.tiles).filter((t) => t.terrain === Terrain.litTorch).forEach((tile) => {
          tile.terrain = Terrain.unlitTorch;
          tile.sprite.texture = this.context.textures.lightMid;
          tile.removeBulb();
        });
      } else if (!this.active &&
          tile.terrain === Terrain.sourceTorch) {
        this.active = true;
      } else if (this.active &&
          tile.terrain === Terrain.sourceTorch) {
        if (Object.values(this.tiles).every((t) => t.terrain !== Terrain.unlitTorch)) {
          this.declareFinished();
        }
      }
    }

    return { ok: true };
  }
}

class GoishiHiroiRoomManager extends RoomManager {
  finished = false;
  lastDir?: Direction = undefined;

  constructor ({ room, context }: {
    room: PossibleBoard,
    context: RenderContext,
  }) {
    super({ room, context, finished: false });
  }

  step (pos: [number, number], dir: Direction) {
    const tile = this.tiles[`${pos[0]}:${pos[1]}`];

    if (this.lastDir && dir === opposites[this.lastDir]) return { ok: false };

    if (tile.terrain === Terrain.water || tile.terrain === Terrain.door) return { ok: false };
    if (tile.terrain === Terrain.ice || tile.terrain === Terrain.usedIceRune) return { ok: true, slide: dir };

    if (!this.finished) {
      if (tile.terrain === Terrain.unusedIceRune) {
        tile.terrain = Terrain.usedIceRune;
        tile.sprite.texture = this.context.textures.usedIceRune;
        tile.removeBulb();

        if (Object.values(this.tiles).every((t) => t.terrain !== Terrain.unusedIceRune)) {
          this.declareFinished();
          this.lastDir = undefined;
        } else {
          this.lastDir = dir;
        }
      }
      else if (tile.terrain === Terrain.path) {
        Object.values(this.tiles).filter((t) => t.terrain === Terrain.usedIceRune).forEach((tile) => {
          tile.terrain = Terrain.unusedIceRune;
          tile.sprite.texture = this.context.textures.unusedIceRune;
          tile.addBulb();
        });
        this.lastDir = undefined;
      }
    }

    return { ok: true };
  }
}

class AltarRoomManager extends RoomManager {
  finished = false;

  constructor ({ room, context }: {
    room: PossibleBoard,
    context: RenderContext,
  }) {
    super({ room, context, finished: false });
  }

  passable(tile: Tile) {
    if (tile.terrain === Terrain.water || tile.terrain === Terrain.door) return false;
    if (tile.mob && tile.mob.mob instanceof AltarMob) return false;

    return true;
  }

  step (pos: [number, number], dir: Direction) {
    const tile = this.tiles[`${pos[0]}:${pos[1]}`];

    if (!this.passable(tile)) return { ok: false };

    if (tile.mob && tile.mob.mob instanceof PileMob) {
      const dest = add(pos[0], pos[1], dir);
      const destTile = this.tiles[`${dest[0]}:${dest[1]}`];
      if (!this.passable(destTile) || destTile.mob) return { ok: false };

      destTile.mob = tile.mob;
      tile.mob = undefined;

      destTile.mob.pos = destTile.pos;
      destTile.mob.sprite.zIndex = destTile.mob.pos[1] + 1;

      Object.values(this.tiles).forEach((tile) => {
        if (tile.mob && tile.mob.mob instanceof AltarMob) {
          const offerings = [
            [tile.pos[0] - 1, tile.pos[1] + 1],
            [tile.pos[0], tile.pos[1] + 1],
            [tile.pos[0] + 1, tile.pos[1] + 1],
          ];

          const torches = [
            [tile.pos[0] + 1, tile.pos[1]],
            [tile.pos[0] - 1, tile.pos[1]],
          ];

          const sum = offerings.map((p) => {
            const adj = this.tiles[`${p[0]}:${p[1]}`];
            return (adj && adj.mob && adj.mob.mob instanceof PileMob ? adj.mob.mob.size : 0);
          }).reduce((a, b) => a + b);

          if (sum === this.template.opts.altarTarget) {
            torches.forEach((p) => {
              const adj = this.tiles[`${p[0]}:${p[1]}`];
              adj.terrain = Terrain.litTorch;
              adj.sprite.texture = this.context.textures.litMid;
              adj.addBulb();
            });
          } else {
            torches.forEach((p) => {
              const adj = this.tiles[`${p[0]}:${p[1]}`];
              adj.terrain = Terrain.unlitTorch;
              adj.sprite.texture = this.context.textures.lightMid;
              adj.removeBulb();
            });
          }
        }
      });

      if (Object.values(this.tiles).every((tile) => tile.terrain !== Terrain.unlitTorch)) {
        this.declareFinished();
      }

      return {
        ok: true,
        mobTransfer: { from: tile, to: destTile }
      };
    }

    return { ok: true };
  }
}
