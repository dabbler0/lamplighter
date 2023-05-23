import Direction from '../util/Direction';
import BoardTemplate, { BoardType } from './BoardTemplate';

export default class PossibleBoard {
  dim: [number, number];
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
