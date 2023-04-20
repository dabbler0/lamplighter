export class List<T> {
  next?: List<T>;
  constructor (
    public head: T,
    public prev?: List<T>) {

    if (this.prev) prev.next = this;

    this.next = null;
  }

  some (fn: (t: T) => boolean): boolean {
    return fn(this.head) || (!!this.prev && this.prev.some(fn));
  }
  forEach (fn: (t: T) => void): void {
    fn(this.head);
    if (this.prev) this.prev.forEach(fn);
  }
}

