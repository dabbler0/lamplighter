import { nameByRace, RaceType } from 'fantasy-name-generator';

const seasons = ['spring', 'fall', 'winter', 'summer'];

enum KnightColor {
  red = 'red',
  green = 'green',
  blue = 'blue',
}

class Knight {
  guessedColor: KnightColor;
  name: string;
  enemies: Set<string>;
  
  constructor (
    public color: KnightColor,
    nameSet: RaceType,
  ) {
    this.name = nameByRace(nameSet, { gender: Math.random() < 0.5 ? 'male' : 'female', allowMultipleNames: true }) as string;
    this.guessedColor = KnightColor.red;
    this.enemies = new Set();
  }

  enemy (knight: Knight) {
    this.enemies.add(knight.name);
    knight.enemies.add(this.name);
  }
}

class KnightGraph {
  knights: Record<string, Knight>;

  constructor (public nameset: RaceType) {
    this.knights = {};

    const redKing = new Knight(KnightColor.red, this.nameset);
    const blueKing = new Knight(KnightColor.blue, this.nameset);
    const greenKing = new Knight(KnightColor.green, this.nameset);
    this.addKnight(redKing);
    this.addKnight(blueKing);
    this.addKnight(greenKing);
    redKing.enemy(blueKing);
    redKing.enemy(greenKing);
    blueKing.enemy(greenKing);

    for (let i = 0; i < 2; i++) {
      this.iterate();
    }
  }

  addKnight (knight: Knight) {
    this.knights[knight.name] = knight;
  }
  
  removeKnight(knight: Knight) {
    Array.from(knight.enemies).forEach((enemy) => {
      this.knights[enemy].enemies.delete(knight.name);
    });
    delete this.knights[knight.name];
  }

  iterate () {
    const knights = Object.values(this.knights)
    const knight = knights[Math.floor(Math.random() * knights.length)];

    this.expand(knight);
  }

  expand (knight: Knight) {
    const anchorColor = Object.values(KnightColor).filter((x) => x !== knight.color)[Math.floor(Math.random() * 2)];
    const coreColor = Object.values(KnightColor).filter((x) => x !== knight.color && x !== anchorColor)[0];

    const anchor = new Knight(anchorColor, this.nameset);
    this.addKnight(anchor);

    const core = new Knight(coreColor, this.nameset);
    this.addKnight(core);

    anchor.enemy(core);

    const anchorLocations = Object.values(this.knights).filter((x) => x.color === coreColor && x !== core);
    const anchorLocation = anchorLocations[Math.floor(Math.random() * anchorLocations.length)];

    anchor.enemy(anchorLocation);

    Array.from(knight.enemies).forEach((enemy) => {
      const fringe = new Knight(knight.color, this.nameset);
      this.addKnight(fringe);
      fringe.enemy(this.knights[enemy]);
      anchor.enemy(fringe);
      core.enemy(fringe);
    });

    this.removeKnight(knight);
  }

  render () {
    const done = new Set<string>();

    const events: [string, string][] = [];

    Object.values(this.knights).forEach(({ name, enemies }) => {
      Array.from(enemies).forEach((enemy) => {
        if (!done.has(enemy)) {
          events.push([ name, enemy ]);
        }
      });
      done.add(name);
    });

    events.sort(() => Math.random() < 0.5 ? 1 : 0);

    const baseYear = Math.floor(Math.random() * 4000);

    const dates = [...Array(events.length)].map(() => Math.floor(Math.random() * 80) + baseYear).sort();

    const declarations: Record<string, string[]> = {};

    Object.keys(this.knights).forEach((key) => declarations[key] = []);

    events.forEach(([a, b], i) => {
      if (Math.random() < 0.5) {
        const isLast = events.every(([x, y], j) => j <= i || x !== b && y !== b);
        declarations[a].push(
          `In the ${seasons[dates[i] % 4]} of ${Math.floor(dates[i] / 4)}, I ${isLast ? 'felled' : 'bested'} ${b}`
        );
        if (isLast) {
          declarations[b].push(
            `In the ${seasons[dates[i] % 4]} of ${Math.floor(dates[i] / 4)}, I was felled by ${a}`
          );
        }
      } else {
        const isLast = events.every(([x, y], j) => j <= i || x !== a && y !== a);
        declarations[b].push(
          `In the ${seasons[dates[i] % 4]} of ${Math.floor(dates[i] / 4)}, I ${isLast ? 'felled' : 'bested'} ${a}`
        );
        if (isLast) {
          declarations[a].push(
            `In the ${seasons[dates[i] % 4]} of ${Math.floor(dates[i] / 4)}, I was felled by ${b}`
          );
        }
      }
    });

    return Object.keys(declarations).sort().map((x) => {
      return `I am ${x}.
${declarations[x].join('\n')}`;
    }).join('\n');
  }
}

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

const graph = new KnightGraph(namesets[Math.floor(Math.random() * namesets.length)]);
console.log(graph.render());
