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

export enum BoardType {
  GoishiHiroi = 'GoishiHiroi',
  Hamiltonian = 'Hamiltonian',
  Altar = 'Altar'
}

export const boardTypes = [
  BoardType.GoishiHiroi,
  BoardType.Hamiltonian,
  BoardType.Altar,
]

export class PossibleBoard {
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

export class UnreifiedBoard extends PossibleBoard {
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

export class ReifiedBoard extends PossibleBoard {
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

export default class TempleGrid {
  rooms: PossibleBoard[];
  activeBoard: ReifiedBoard;

  constructor (private activeOpts: {
    textures: Record<string, Texture>;
    scale: number;
    app: Application;
    blurFilter: Filter;
    lightingLayer: Layer;
  }) {
    const { template, type } = this.generateTemplate(1, BoardType.GoishiHiroi);
    const preActiveBoard = new UnreifiedBoard({
      pos: [0, 0],
      level: 1,
      template,
      type
    });

    this.rooms = [preActiveBoard];
    this.activeBoard = this.reify(preActiveBoard);
  }

  generateHamiltonian (roomLevel: number) {
    const newBoard = new HamiltonianBoard(
      Math.floor(Math.sqrt(5 * roomLevel + 4)),
      Math.floor(Math.sqrt(5 * roomLevel + 4))
    );
    return BoardTemplate.fromHamiltonian(newBoard);
  }

  generateKnightGraph (roomLevel: number) {
    const newBoard = new KnightGraph(
      Math.ceil((roomLevel - 5) / 10)
    );
    return BoardTemplate.fromKnightGraph(newBoard);
  }

  generateGoishiHiroi (roomLevel: number) {
    const newBoard = new GoishiHiroiBoard(
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      Math.floor(Math.sqrt(5 * roomLevel + 5)),
      roomLevel,
    );
    return BoardTemplate.fromGoishiHiroi(newBoard);
  }

  generateAltar (roomLevel: number) {
    const newBoard = new AltarBoard(
      Math.ceil(roomLevel / 3)
    );
    return BoardTemplate.fromAltar(newBoard);
  }

  generateTemplate (level: number, exclude: BoardType) {
    const candidates = boardTypes.filter((x) => x !== exclude);
    const selection = candidates[Math.floor(Math.random() * candidates.length)];
    const template = 
      selection === BoardType.GoishiHiroi ? this.generateGoishiHiroi(level) :
      selection === BoardType.Hamiltonian ? this.generateHamiltonian(level)
      : this.generateAltar(level);

    return { template, type: selection };
  }

  placeTemplate (initial: PossibleBoard, dir: Direction, template: BoardTemplate): [number, number] {
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

  reify (board: UnreifiedBoard, startDir?: Direction, prev?: ReifiedBoard) {
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
        const { template, type } = this.generateTemplate(board.level + 1, board.type);
        const candidate = new UnreifiedBoard({
          template,
          level: board.level + 1,
          pos: this.placeTemplate(board, dir, template),
          type
        });

        if (this.rooms.every((room) => !room.intersects(candidate))) {
          this.rooms.push(candidate);
          exits[dir] = candidate;
        }
      }
    });

    const result = new ReifiedBoard({
      pos: board.pos,
      board: new ActiveBoard({
        ...board.template,
        ...this.activeOpts,
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

    this.rooms = this.rooms.filter((x) => x !== board);
    this.rooms.push(result);

    return result;
  }
}

