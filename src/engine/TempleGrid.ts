import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { Layer, Stage } from '@pixi/layers';
import Direction, { add, opposites } from '../util/Direction';
import List from '../util/List';
import HamiltonianBoard from '../generators/HamiltonianBoard';
import GoishiHiroiBoard from '../generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from '../generators/KnightGraph';
import AltarBoard from '../generators/AltarBoard';
import BoardTemplate, { BoardType, boardTypes, Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob } from './BoardTemplate';
import RoomManager from './RoomManager';
import { nameByRace, RaceType } from 'fantasy-name-generator';
import Tile from './Tile';
import RenderContext from './RenderContext';
import PossibleBoard from './PossibleBoard';
import PlayerState from './PlayerState';

const namesets: RaceType[] = [
  "cavePerson",
  "dwarf",
  "halfling",
  "gnome",
  "elf",
  "highelf",
  "fairy",
  "highfairy",
  "darkelf",
  "drow",
  "halfdemon",
  "dragon",
  "angel",
  "demon",
  "goblin",
  "orc",
  "ogre",
  "human"
];

function randomName() {
  return nameByRace(
    namesets[Math.floor(Math.random() * namesets.length)],
    { gender: Math.random() < 0.5 ? 'male' : 'female', allowMultipleNames: true }) as string;
}


export default class TempleGrid {
  rooms: PossibleBoard[];
  unusedKeys: Set<string> = new Set();
  tiles: Record<string, Tile> = {};
  managers: Record<string, RoomManager> = {};

  animations: { countdown: number; fn: (t: number) => void; callback: () => void; }[] = [];

  constructor (private context: RenderContext) {
    const { template, type } = this.generateTemplate(5, BoardType.GoishiHiroi);
    this.rooms = [new PossibleBoard(
      [0, 0],
      5,
      type,
      template,
    )];
  }

  generateFinite (n: number) {
    // Generate n rooms
    for (let i = 0; i < n; i++) {
      const unextendedCandidates = this.rooms.filter((x) => !x.extended);

      const next = unextendedCandidates[Math.floor(Math.random() * unextendedCandidates.length)];

      this.extend(next);
    }

    // Remove anything still unextended
    this.rooms.filter((x) => !x.extended).forEach((room) => {
      if (room.prev) {
        room.prev.exits[opposites[room.startDir]] = null;
      }
    });

    const extended = this.rooms.filter((x) => x.extended);
    this.rooms = extended;

    // Completely redo keys and locks to minimize
    // unused keys

    const allKeyLocks = extended.filter((room) => room.type === BoardType.KeyOrLock);
    const remainingIndices = allKeyLocks.map((_, i) => i);

    while (remainingIndices.length > 1) {
      const ii1 = Math.floor(Math.random() * remainingIndices.length);
      const i1 = remainingIndices[ii1];
      remainingIndices.splice(ii1, 1);

      const ii2 = Math.floor(Math.random() * remainingIndices.length);
      const i2 = remainingIndices[ii2];
      remainingIndices.splice(ii2, 1);

      const [a, b] = [i1, i2].sort((a, b) => a - b);

      const key = randomName();

      allKeyLocks[a].template = BoardTemplate.generateKey(key);
      allKeyLocks[b].template = BoardTemplate.generateLock(key);
    }

    // If odd number, empty the last one
    if (remainingIndices.length === 1) {
      const room = allKeyLocks[remainingIndices[0]];
      room.template = this.generateEmpty(...room.dim).template;
    }

    this.rooms.forEach((room) => this.reify(room));
  }


  generateHamiltonian (roomLevel: number): { template: BoardTemplate, placeCallback?: () => void} {
    const newBoard = new HamiltonianBoard(
      Math.floor(Math.sqrt(5 * roomLevel + 4)),
      Math.floor(Math.sqrt(5 * roomLevel + 4))
    );
    return { template: BoardTemplate.fromHamiltonian(newBoard) };
  }

  generateKnightGraph (roomLevel: number): { template: BoardTemplate, placeCallback?: () => void} {
    const newBoard = new KnightGraph(
      Math.ceil((roomLevel - 5) / 10)
    );
    return { template: BoardTemplate.fromKnightGraph(newBoard) };
  }

  generateGoishiHiroi (roomLevel: number): { template: BoardTemplate, placeCallback?: () => void} {
    const newBoard = new GoishiHiroiBoard(
      2 * Math.ceil(Math.sqrt(5 * roomLevel + 5) / 2) + 1,
      2 * Math.ceil(Math.sqrt(5 * roomLevel + 5) / 2) + 1,
      roomLevel * 3,
    );
    return { template: BoardTemplate.fromGoishiHiroi(newBoard) };
  }

  generateAltar (roomLevel: number): { template: BoardTemplate, placeCallback?: () => void} {
    const newBoard = new AltarBoard(
      Math.ceil(roomLevel / 3)
    );
    return { template: BoardTemplate.fromAltar(newBoard) };
  }

  generateEmpty (w: number, h: number): { template: BoardTemplate, placeCallback?: () => void} {
    return {
      template: BoardTemplate.generateEmpty(w, h)
    }
  }

  generateRest (w: number, h: number): { template: BoardTemplate, placeCallback?: () => void} {
    return {
      template: BoardTemplate.generateRest(w, h)
    };
  }

  generateKeyOrLock (): { template: BoardTemplate, placeCallback: () => void} {
    if (this.unusedKeys.size === 0 || Math.random() < 1 / (this.unusedKeys.size + 1)) {
      const key = randomName();
      return {
        template: BoardTemplate.generateKey(key),
        placeCallback: () => this.unusedKeys.add(key)
      }
    } else {
      const selectionArray = Array.from(this.unusedKeys);
      const chosenKey = selectionArray[Math.floor(Math.random() * selectionArray.length)]
      this.unusedKeys.delete(chosenKey);
      return {
        template: BoardTemplate.generateLock(chosenKey),
        placeCallback: () => this.unusedKeys.delete(chosenKey)
      }
    }
  }

  generateTemplate (level: number, exclude: BoardType) {
    const candidates = boardTypes.filter((x) => x !== exclude);
    const selection = candidates[Math.floor(Math.random() * candidates.length)];
    const { template, placeCallback } = 
      selection === BoardType.GoishiHiroi ? this.generateGoishiHiroi(level) :
      selection === BoardType.Hamiltonian ? this.generateHamiltonian(level) :
      selection === BoardType.Altar ? this.generateAltar(level) :
      selection === BoardType.Rest ? this.generateRest(
        Math.ceil(Math.random() * 5),
        Math.ceil(Math.random() * 3),
      ) :
      this.generateKeyOrLock();

    return { template, type: selection, placeCallback };
  }

  placeTemplate (initial: PossibleBoard, dir: Direction, template: BoardTemplate): [number, number] {
    if (dir === Direction.left) {
      return [
        initial.pos[0] - template.width() - 2,
        initial.pos[1] + Math.floor(initial.dim[1] / 2) - Math.floor(template.height() / 2)
      ];
    } else if (dir === Direction.right) {
      return [
        initial.pos[0] + initial.dim[0] + 2,
        initial.pos[1] + Math.floor(initial.dim[1] / 2) - Math.floor(template.height() / 2)
      ];
    } else if (dir === Direction.up) {
      return [
        initial.pos[0] + Math.floor(initial.dim[0] / 2) - Math.floor(template.width() / 2),
        initial.pos[1] - template.height() - 2,
      ];
    } else if (dir === Direction.down) {
      return [
        initial.pos[0] + Math.floor(initial.dim[0] / 2) - Math.floor(template.width() / 2),
        initial.pos[1] + initial.dim[1] + 2,
      ];
    }
  }

  extend (room: PossibleBoard) {
    if (room.extended) return;

    (Object.values(Direction) as Direction[]).forEach((dir) => {
      if (dir === room.startDir) {
        return;
      } else {
        const { template, type, placeCallback } = this.generateTemplate(room.level + 1, 
        room.type);
        const candidate = new PossibleBoard(
          this.placeTemplate(room, dir, template),
          room.level + 1,
          type,
          template,
          opposites[dir],
          room,
        );

        if (this.rooms.every((room) => !room.intersects(candidate))) {
          this.rooms.push(candidate);
          room.exits[dir] = candidate;
          if (placeCallback) placeCallback();
        }
      }
    });

    room.extended = true;
  }

  reify (room: PossibleBoard) {
    const roomManager = RoomManager.create({ room, context: this.context });

    Object.entries(roomManager.tiles).forEach(([key, tile]) => {
      this.tiles[key] = tile
      this.managers[key] = roomManager;
    });
  }

  tick (delta: number) {
    this.animations = this.animations.filter((obj) => {
      obj.countdown = Math.max(0, obj.countdown - delta);
      obj.fn(obj.countdown);

      if (obj.countdown <= 0) {
        obj.callback();
        return false;
      }
      return true;
    });
  }

  async animate (countdown: number, tick: (t: number) => void) {
    return new Promise<void>((resolve) => {
      this.animations.push({
        countdown,
        fn: (t: number) => tick(1 - t / countdown),
        callback: () => resolve()
      });
    });
  }

  async applyMove (state: PlayerState, dir: Direction): Promise<void> {
    const next = add(state.pos[0], state.pos[1], dir);
    const manager = this.managers[
      `${next[0]}:${next[1]}`
    ];
    const { ok, slide } = manager ? manager.step(next, dir) : { ok: false, slide: undefined };

    if (ok) {
      this.context.player.zIndex = Math.max(state.pos[1], next[1]) + 1;
      await this.animate(5, (p) => {
        this.context.player.position.x = ((1 - p) * state.pos[0] + p * next[0]) * this.context.scale;
        this.context.player.position.y = ((1 - p) * state.pos[1] + p * next[1]) * this.context.scale;
      });
      state.pos = next;
      manager.reveal();
    }
    if (slide) return await this.applyMove(state, slide);
    return;
  }
}
