import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import List from './List';
import Direction, { add, opposites } from './Direction';

export default class GoishiHiroiBoard {
  goldPath: List<[number, number, Direction | null]>;
  width: number;
  height: number;

  constructor (width: number, height: number, lengthLimit: number) {
    this.width = width;
    this.height = height;

    // Random walk up to lengthLimit
    this.goldPath = new List<[number, number, Direction | null]>(
      [0, 0, null],
    );

    const taken = new Set<string>();

    for (let i = 0; i < lengthLimit; i++) {
      const [i, j, d] = this.goldPath.head;

      const allCandidates: Record<Direction, [number, number][]> = {
        [Direction.up]: [...Array(height)].map((_, c) => c).filter((c) =>
          c < j && !taken.has(`${i}:${c}`)
        ).map((c) => [i, c]),
        [Direction.down]: [...Array(height)].map((_, c) => c).filter((c) =>
          c > j && !taken.has(`${i}:${c}`)
        ).map((c) => [i, c]),
        [Direction.left]: [...Array(width)].map((_, c) => c).filter((c) =>
          c < i && !taken.has(`${c}:${j}`)
        ).map((c) => [c, j]),
        [Direction.right]: [...Array(width)].map((_, c) => c).filter((c) =>
          c > i && !taken.has(`${c}:${j}`)
        ).map((c) => [c, j]),
      };

      const directionCandidates: Direction[] = (Object.keys(allCandidates) as Direction[])
        .filter((key) => allCandidates[key].length > 0 && key !== opposites[d]);

      if (directionCandidates.length === 0) break;

      const direction = directionCandidates[Math.floor(Math.random() * directionCandidates.length)];

      const candidates = allCandidates[direction];

      const [ni, nj] = candidates[Math.floor(Math.random() * candidates.length)];

      candidates.filter(([mi, mj]) => {
        if ((mi <= ni && mi >= i || mi <= i && mi >= ni) &&
            (mj <= nj && mj >= j || mj <= j && mj >= nj)) {
          taken.add(`${mi}:${mj}`);
        }
      });

      this.goldPath = new List([ni, nj, direction], this.goldPath);
    }
  }
}
