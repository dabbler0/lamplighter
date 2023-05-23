import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import RenderContext from './RenderContext';
import { Terrain } from './BoardTemplate';

export class Mob {
  constructor () {}
}

export default class Tile {
  pos: [number, number];
  sprite: Sprite;
  terrain: Terrain;
  context: RenderContext;
  mob?: Mob;
  bulb?: Graphics;
  particles: boolean;
  visible: boolean;

  constructor({
    pos, texture, context, terrain,
    mob, bulb, particles, visible,
  }: {
    pos: [number, number];
    texture: Texture;
    terrain: Terrain;
    context: RenderContext;
    mob?: Mob;
    bulb?: boolean;
    particles?: boolean;
    visible: boolean;
  }) {
    this.pos = pos;
    this.sprite = new Sprite(texture);

    this.sprite.scale.x = context.scale / 200;
    this.sprite.scale.y = context.scale / 200;

    this.sprite.position.x = pos[0] * context.scale;
    this.sprite.position.y = pos[1] * context.scale;
    this.sprite.zIndex = pos[1];
    this.sprite.visible = visible;

    this.terrain = terrain;
    this.mob = mob;
    this.context = context;
    this.particles = !!particles;
    this.visible = visible;

    if (bulb) this.addBulb();
  }

  makeVisible () {
    if (!this.visible) {
      this.visible = true;
      this.sprite.visible = true;
    }
  }

  init () {
    this.context.rootContainer.addChild(this.sprite);
  }

  addBulb () {
    if (this.bulb) return;

    const bulb = new Graphics();
    bulb.beginFill(0xddffdd, 0.5);
    bulb.drawCircle(0, 0, 500);
    bulb.endFill();
    (bulb as any).parentLayer = this.context.lightingLayer;
    bulb.position.x = 100;
    bulb.position.y = 100;
    bulb.filters = [this.context.blur];

    this.sprite.addChild(bulb);
    this.bulb = bulb;
  }

  removeBulb () {
    if (!this.bulb) return;

    this.sprite.removeChild(this.bulb);
    this.bulb = undefined;
  }
}
