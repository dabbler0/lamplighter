import Direction from '../util/Direction';
import List from '../util/List';
import HamiltonianBoard from '../generators/HamiltonianBoard';
import GoishiHiroiBoard from '../generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from '../generators/KnightGraph';
import AltarBoard from '../generators/AltarBoard';

export enum Terrain {
  water = 'water',
  litTorch = 'litTorch',
  unlitTorch = 'unlitTorch',
  path = 'path',
  ice = 'ice',
  unusedIceRune = 'unusedIceRune',
  usedIceRune = 'usedIceRune',
  purple = 'purple',
  grass = 'grass',
}

export type LevelOptions = {
  hRoot?: [number, number]
  altarTarget?: number;
  goishiHiroi?: boolean;
  keyProvided?: string;
  autoFinish?: boolean;
  lockRequired?: string;
};
export interface Mob {
  pos: [number, number];
}

export class ChestMob implements Mob {
  pos: [number, number];
  open: boolean;

  constructor({
    pos
  }: { pos: [number, number] }) {
    this.pos = pos;
    this.open = false;
  }
}

export class LockerMob implements Mob {
  pos: [number, number];
  open: boolean;

  constructor({
    pos
  }: { pos: [number, number] }) {
    this.pos = pos;
    this.open = false;
  }
}

export class PileMob implements Mob {
  size: number;
  pos: [number, number];

  constructor({
    size, pos
  }: { size: number; pos: [number, number] }) {
    this.size = size;
    this.pos = pos;
  }
}

export class AltarMob implements Mob {
  pos: [number, number]

  constructor({ pos }: { pos: [number, number] }) {
    this.pos = pos;
  }
}

export class KnightMob implements Mob {
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

export default class BoardTemplate {
  // Terrain
  terrain: Terrain[][];

  // Items on top of terrain
  mobs: Mob[];

  opts: LevelOptions;

  constructor ({
    terrain,
    mobs,
    opts,
  }: {
    terrain: Terrain[][];
    mobs: Mob[];
    opts: LevelOptions;
  }) {
    this.terrain = terrain;
    this.opts = opts;
    this.mobs = mobs;
  }

  static fromKnightGraph(knightGraph: KnightGraph) {
    const size = Object.keys(knightGraph.knights).length;

    const width = Math.ceil(Math.sqrt(size));
    const height = Math.ceil(Math.sqrt(size));

    const mobs: KnightMob[] = [];

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
    });
  }

  static fromAltar(board: AltarBoard) {
    const terrain: Terrain[][] = [];
    const mobs: Mob[] = [];

    const color = Object.values(KnightColor)[Math.floor(Math.random() * 3)];

    for (let i = 0; i < board.numBuckets * 4 + 5; i++) {
      terrain[i] = [];
      for (let j = 0; j < 12; j++) {
        terrain[i][j] = Terrain.path;
      }
    }

    for (let i = 0; i < board.numBuckets * 4 + 3; i++) {
      terrain[i + 1][1] = Terrain.water;
      terrain[i + 1][10] = Terrain.water;
    }
    terrain[Math.floor((board.numBuckets * 4 + 5) / 2)][10] = Terrain.path;
    terrain[Math.floor((board.numBuckets * 4 + 5) / 2)][1] = Terrain.path;

    for (let j = 0; j < 10; j++) {
      terrain[1][j + 1] = Terrain.water;
      terrain[board.numBuckets * 4 + 3][j + 1] = Terrain.water;
    }

    for (let i = 0; i < board.numBuckets; i++) {
      mobs.push(new AltarMob({
        pos: [4 + i * 4, 3]
      }));
      for (let j = 0; j < 3; j++) {
        terrain[3 + i * 4 + j][4] = Terrain.purple;
      }
      terrain[3 + i * 4][3] = Terrain.unlitTorch;
      terrain[5 + i * 4][3] = Terrain.unlitTorch;
    }

    const piles = board.beadPiles.slice(0).sort(() => Math.random() < 0.5 ? 1 : -1);

    for (let i = 0; i < piles.length; i++) {
      if (piles[i] !== 0) {
        mobs.push(new PileMob({
          size: piles[i],
          pos: [3 + i, 8]
        }));
      }
    }

    return new this({
      terrain,
      mobs,
      opts: { altarTarget: board.numBuckets * 3 },
    });
  }

  static fromGoishiHiroi(board: GoishiHiroiBoard) {
    const { width, height } = board;
    const { terrain } = BoardTemplate.generateEmpty(width + 6, height + 6);

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        terrain[i + 3][j + 3] = Terrain.ice;
      }
    }

    for (let cursor = board.goldPath; !!cursor; cursor = cursor.prev) {
      const [i, j] = cursor.head;
      terrain[i + 3][j + 3] = Terrain.unusedIceRune;
    }

    return new this({
      terrain,
      mobs: [],
      opts: {
        goishiHiroi: true,
      },
    });
  }

  static fromHamiltonian(hamiltonianBoard: HamiltonianBoard) {
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

    terrain[width + 1][1] = Terrain.path;

    terrain[Math.floor(width / 2) * 2 + 2][height * 2] = Terrain.litTorch;
    terrain[width + 1][height * 2 + 1] = Terrain.path;

    return new this({
      terrain,
      mobs: [],
      opts: { hRoot: [ Math.floor(width / 2) * 2 + 2, height * 2 ] },
    });
  }

  static generateKey (name: string) {
    const { terrain } = BoardTemplate.generateEmpty(7, 7);

    const mobs: Mob[] = [];

    mobs.push(new ChestMob({
      pos: [3, 3]
    }));

    return new this({
      terrain,
      mobs,
      opts: {
        keyProvided: name,
        autoFinish: true,
      },
    });
  }

  static generateLock (name: string) {
    const { terrain } = BoardTemplate.generateEmpty(7, 7);

    const mobs: Mob[] = [];

    mobs.push(new LockerMob({
      pos: [3, 3]
    }));

    return new this({
      terrain,
      mobs,
      opts: {
        lockRequired: name,
      },
    });
  }

  static generateEmpty (w: number, h: number) {
    const terrain: Terrain[][] = [];

    for (let i = 0; i < w; i++) {
      terrain[i] = [];
      for (let j = 0; j < h; j++) {
        terrain[i][j] = Terrain.water;
      }
    }

    for (let i = 2; i < w - 2; i++) {
      for (let j = 2; j < h - 2; j++) {
        terrain[i][j] = Terrain.path;
      }
    }

    for (let i = 0; i < w; i++) {
      terrain[i][0] = Terrain.path;
      terrain[i][h - 1] = Terrain.path;
    }

    for (let j = 0; j < h; j++) {
      terrain[0][j] = Terrain.path;
      terrain[w - 1][j] = Terrain.path;
    }

    terrain[1][Math.floor(h / 2)] = Terrain.path;
    terrain[w - 2][Math.floor(h / 2)] = Terrain.path;
    terrain[Math.floor(w / 2)][1] = Terrain.path;
    terrain[Math.floor(w / 2)][h - 2] = Terrain.path;

    return new this({
      terrain,
      mobs: [],
      opts: { autoFinish: true },
    });
  }

  static generateRest (w: number, h: number) {
    const terrain: Terrain[][] = [];
    const mobs: Mob[] = [];

    const width = 2 * Math.ceil((w * 6 + 2) / 2) + 1;
    const height = 2 * Math.ceil((h * 7 + 2) / 2) + 1;

    for (let i = 0; i < width; i++) {
      terrain[i] = [];
      for (let j = 0; j < height; j++) {
        terrain[i][j] = Terrain.grass;
      }
    }

    for (let i = 0; i < width; i++) {
      terrain[i][0] = Terrain.path;
      terrain[i][height - 1] = Terrain.path;
    }

    for (let j = 0; j < height; j++) {
      terrain[0][j] = Terrain.path;
      terrain[width - 1][j] = Terrain.path;
    }

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        for (let k = 0; k < 5; k++) {
          for (let m = 0; m < 4; m++) {
            terrain[i * 6 + 2 + m][j * 7 + 2 + k] = Terrain.path;
          }
        }

        if ((w >= 4 && (i === 0 || i === w - 1) ||
           h >= 3 && (j === 0 || j === h - 1))) {
          mobs.push(new AltarMob({
            pos: [
              i * 6 + 3,
              j * 7 + 3,
            ]
          }));
          mobs.push(new AltarMob({
            pos: [
              i * 6 + 4,
              j * 7 + 5,
            ]
          }));
          for (let k = 0; k < 3; k++) {
            for (let m = 0; m < 2; m++) {
              terrain[i * 6 + 3 + m][j * 7 + 3 + k] = Terrain.purple;
            }
          }
        } else {
          for (let k = 0; k < 3; k++) {
            for (let m = 0; m < 2; m++) {
              terrain[i * 6 + 3 + m][j * 7 + 3 + k] = Terrain.water;
            }
          }
        }
        terrain[i * 6 + 2][j * 7 + 2] = Terrain.litTorch;
        terrain[i * 6 + 5][j * 7 + 2] = Terrain.litTorch;
        terrain[i * 6 + 2][j * 7 + 6] = Terrain.litTorch;
        terrain[i * 6 + 5][j * 7 + 6] = Terrain.litTorch;
      }
    }

    return new this({
      terrain,
      mobs,
      opts: { autoFinish: true },
    });
  }

  width () {
    return this.terrain.length;
  }

  height () {
    return this.terrain[0].length;
  }
}
