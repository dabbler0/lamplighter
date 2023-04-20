import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import List from './List';
import Direction, { add } from './Direction

export default class HamiltonianBoard {
  goldPath: List<[number, number]>;
  edges: Set<string>;
  width: number;
  height: number;

  constructor (w: number, h: number) {
    this.edges = new Set<string>();
    this.width = w;
    this.height = h;

    // "random nudging" to create the path
    this.goldPath = new List(
      [0, 1],
      new List(
        [1, 1],
        new List(
          [1, 0],
          new List(
            [0, 0]
          )
        )
      )
    );

    const taken = new Set<string>();
    this.goldPath.forEach(([i, j]) => taken.add(`${i}:${j}`));

    function allBetween([i1, j1]: [number, number], [i2, j2]: [number, number]): [number, number][] {
      if (i1 === i2) {
        if (j2 < j1) return [...Array(j1 - j2 + 1)].map((_, delta) => [i1, j1 - delta]);
        return [...Array(j2 - j1 + 1)].map((_, delta) => [i1, j1 + delta]);
      }
      else if (j1 === j2) {
        if (i2 < i1) return [...Array(i1 - i2 + 1)].map((_, delta) => [i1 - delta, j1]);
        return [...Array(i2 - i1 + 1)].map((_, delta) => [i1 + delta, j1]);
      }
      return [];
    }

    function inBounds([i, j]: [number, number]): boolean {
      return i >= 0 && j >= 0 && i < w && j < h;
    }

    function valid([i, j]: [number, number]): boolean {
      return i >= 0 && j >= 0 && i < w && j < h && !taken.has(`${i}:${j}`);
    }

    for (let i = 0; i < w * h * 3 / 4; i++) {
      const candidates: [
        List<[number, number]>,
        [number, number][],
        List<[number, number]>
      ][] = [];
      for (let cursor = this.goldPath; !!cursor.prev; cursor = cursor.prev) {
        // This edge:
        const [i1, j1] = cursor.head;
        // Direction:
        const iDirection = cursor.head[0] === cursor.prev.head[0];

        for (let tail = cursor.prev; !!tail; tail = tail.prev) {
          const [i2, j2] = tail.head;

          if (iDirection && i2 !== i1) break;
          if (!iDirection && j2 !== j1) break;

          const tries = i1 === i2 ? [
            allBetween([i2 + 1, j2], [i1 + 1, j1]),
            allBetween([i2 - 1, j2], [i1 - 1, j1]),
          ] : [
            allBetween([i2, j2 + 1], [i1, j1 + 1]),
            allBetween([i2, j2 - 1], [i1, j1 - 1])
          ];

          for (const t of tries) {
            if (t.every(valid)) {
              candidates.push(
                [
                  tail, t, cursor,
                ]
              );
            }
          }
        }
      }

      if (candidates.length === 0) break;

      const [tail, t, head] = candidates[
        Math.floor(Math.random() * candidates.length)
      ];

      // Intermediates no longer taken
      for (let cursor = head.prev; cursor !== tail; cursor = cursor.prev) {
        const [i, j] = cursor.head;
        taken.delete(`${i}:${j}`);
      }

      // Insert intermediates
      let insertList = tail;
      for (let [i, j] of t) {
        insertList = new List([i, j], insertList);
        taken.add(`${i}:${j}`);
      }

      head.prev = insertList;
      insertList.next = head;
    }

    this.addEdge([0, 0], [0, 1]);

    const pathElements = new Set<string>();

    for (let cursor = this.goldPath; !!cursor; cursor = cursor.prev) {
      const [i, j] = cursor.head;
      pathElements.add(`${i}:${j}`);
      if (cursor.prev) {
        this.addEdge(cursor.head, cursor.prev.head);
      }
    }

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        const available = Object.values(Direction).map((d) => add(i, j, d))
          .filter(([ci, cj]) => {
            console.log('test', ci, cj, valid([ci, cj]), this.degree(ci, cj));
            return (
              inBounds([ci, cj]) &&
              this.degree(ci, cj) < (
                pathElements.has(`${ci}:${cj}`) ? 3
                : 2
              )
            );
          });

        const present = Object.values(Direction).map((d) => add(i, j, d))
          .filter(([ci, cj]) => this.hasEdge([i, j], [ci, cj]));

        const desiredDegree = pathElements.has(`${i}:${j}`) ? 3 : 2;

        console.log(available, present, desiredDegree);

        if (present.length < desiredDegree && available.length >= desiredDegree) {
          const candidates = available.filter(([ci, cj]) => !present.some(([oi, oj]) => oi === ci && oj === cj));
          const candidate = candidates[Math.floor(Math.random() * candidates.length)];

          this.addEdge([i, j], candidate);
        }
      }
    }
  }

  degree(i: number, j: number) {
    return Object.values(Direction).map((d) => add(i, j, d)).filter((coord) => this.hasEdge([i, j], coord)).length;
  }

  addEdge([i1, j1]: [number, number], [i2, j2]: [number, number]) {
    const [left, right] = [
      `${i1}:${j1}`,
      `${i2}:${j2}`
    ].sort();

    this.edges.add(`${left}::${right}`);
  }

  hasEdge([i1, j1]: [number, number], [i2, j2]: [number, number]) {
    const [left, right] = [
      `${i1}:${j1}`,
      `${i2}:${j2}`
    ].sort();

    return this.edges.has(`${left}::${right}`);
  }
}
