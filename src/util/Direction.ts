enum Direction {
  up = 'up',
  down = 'down',
  right = 'right',
  left = 'left'
};

export default Direction;

export const opposites = {
  [Direction.up]: Direction.down,
  [Direction.down]: Direction.up,
  [Direction.left]: Direction.right,
  [Direction.right]: Direction.left,
};

export function add(i: number, j: number, d: Direction): [number, number] {
  return d === Direction.up ? [i, j - 1] :
    d === Direction.down ? [i, j + 1] :
    d === Direction.right ? [i + 1, j] :
    [i - 1, j];
}
