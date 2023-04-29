import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites } from '../util/Direction';
import List from '../util/List';
import HamiltonianBoard from '../generators/HamiltonianBoard';
import GoishiHiroiBoard from '../generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from '../generators/KnightGraph';
import AltarBoard from '../generators/AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob } from './BoardTemplate';
import ActiveBoard from './ActiveBoard';
import { nameByRace, RaceType } from 'fantasy-name-generator';

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

export enum BoardType {
  GoishiHiroi = 'GoishiHiroi',
  Hamiltonian = 'Hamiltonian',
  Altar = 'Altar',
  KeyOrLock = 'KeyOrLock',
}

export const boardTypes = [
  BoardType.GoishiHiroi,
  BoardType.Hamiltonian,
  BoardType.Altar,
  BoardType.KeyOrLock,
]

export class PossibleBoard {
  dim: [number, number];
  board?: ActiveBoard;
  exits: Partial<Record<Direction, PossibleBoard>> = {};
  extended: boolean = false;

  constructor (
    public pos: [number, number],
    public level: number,
    public type: BoardType,
    public template: BoardTemplate,
    public startDir?: Direction,
    public prev?: PossibleBoard,
  ) {
    this.dim = [template.width(), template.height()];
    if (startDir && prev) this.exits[startDir] = prev;
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

export default class TempleGrid {
  rooms: PossibleBoard[];
  activeBoard: PossibleBoard;
  unusedKeys: Set<string>;

  constructor (private activeOpts: {
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
  }) {
    this.unusedKeys = new Set();
    const { template, type } = this.generateTemplate(1, BoardType.GoishiHiroi);
    this.activeBoard = new PossibleBoard(
      [0, 0],
      1,
      type,
      template,
    );

    this.rooms = [this.activeBoard];
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
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      roomLevel,
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
    if (room.board) return;

    room.board = new ActiveBoard({
      ...room.template,
      ...this.activeOpts,
      startDir: room.startDir,
      allDirs: {
        [Direction.left]: !!room.exits[Direction.left],
        [Direction.right]: !!room.exits[Direction.right],
        [Direction.up]: !!room.exits[Direction.up],
        [Direction.down]: !!room.exits[Direction.down],
      }
    });
  }
}

