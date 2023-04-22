export default class AltarBoard {
  numBuckets: number;
  beadPiles: number[];

  constructor (numBuckets: number) {
    this.numBuckets = numBuckets;

    const eachSum = numBuckets * 3;
    
    this.beadPiles = [];

    for (let i = 0; i < numBuckets; i++) {
      // Bars-and-stars
      const dividerOne = Math.floor(Math.random() * (eachSum + 2));
      let dividerTwo = Math.floor(Math.random() * (eachSum + 1));
      if (dividerOne === dividerTwo) dividerTwo++;

      const dividers = [dividerOne, dividerTwo].sort((a, b) => a > b ? 1 : -1);

      this.beadPiles.push(dividers[0]);
      this.beadPiles.push(dividers[1] - dividers[0] - 1);
      this.beadPiles.push(eachSum + 1 - dividers[1]);
    }
  }
}
