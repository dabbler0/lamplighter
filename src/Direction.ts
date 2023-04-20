enum Direction {
  up = 'up',
  down = 'down',
  right = 'right',
  left = 'left'
};

export default Direction;

export function add(i: number, j: number, d: Direction): [number, number] {
  return d === Direction.up ? [i, j - 1] :
    d === Direction.down ? [i, j + 1] :
    d === Direction.right ? [i + 1, j] :
    [i - 1, j];
}
