import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import RenderContext from './RenderContext';
import { Terrain, Mob, ChestMob, AltarMob, PileMob } from './BoardTemplate';

const orbTextures: Record<number, Texture> = {};
function getOrbTexture(n: number, textures: Record<string, Texture>, app: Application) {
  if (n in orbTextures) return orbTextures[n];

  const container = new Container();
  for (let i = 0; i < Math.floor(n / 4); i++) {
    const sprite = new Sprite(textures.orbs4);
    sprite.position.y = i * -50;
    container.addChild(sprite);
  }

  if (n % 4 >= 2) {
    const twoSprite = new Sprite(textures.orbs2);
    twoSprite.position.y = Math.max(0, Math.floor(n / 4) - 1) * -50
    container.addChild(twoSprite);
  }
  if (n % 2 === 1) {
    const oneSprite = new Sprite(textures.orbs1);
    oneSprite.position.y = Math.max(0, Math.floor(n / 4) - 1) * -50
    container.addChild(oneSprite);
  }

  const renderTexture = RenderTexture.create({
    width: 200,
    height: 200 + 50 * Math.max(0, Math.floor(n / 4) - 1),
  });

  container.position.y = 50 * Math.max(0, Math.floor(n / 4) - 1);

  app.renderer.render(container, { renderTexture });

  orbTextures[n] = renderTexture;

  return renderTexture;
}

function mobTexture(mob: Mob, context: RenderContext) {
  if (mob instanceof AltarMob) {
    return context.textures.blueKnight;
  } else if (mob instanceof PileMob) {
    return getOrbTexture(mob.size, context.textures, context.app);
  }
}

export class MobRender {
  mob: Mob;
  sprite: Sprite;
  pos: [number, number];
  context: RenderContext;
  visible: boolean;

  constructor ({ mob, pos, visible, context }: {
    mob: Mob;
    pos: [number, number];
    context: RenderContext;
    visible: boolean;
  }) {
    this.mob = mob;
    this.pos = pos;
    this.context = context;
    this.visible = visible;

    this.sprite = new Sprite(mobTexture(mob, context));

    this.sprite.anchor.y = (this.sprite.height - 200) / this.sprite.height;
    this.sprite.scale.x = context.scale / 200;
    this.sprite.scale.y = context.scale / 200;

    this.sprite.position.x = pos[0] * context.scale;
    this.sprite.position.y = pos[1] * context.scale;

    this.sprite.zIndex = pos[1] + 1;
    this.sprite.visible = visible;
  }

  init () {
    this.context.rootContainer.addChild(this.sprite);
  }

  makeVisible() {
    if (!this.visible) {
      this.visible = true;
      this.sprite.visible = true;
    }
  }
}

export default class Tile {
  pos: [number, number];
  sprite: Sprite;
  terrain: Terrain;
  context: RenderContext;
  mob?: MobRender;
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
    this.mob = mob ? new MobRender({ mob, pos, context, visible }) : undefined;
    this.context = context;
    this.particles = !!particles;
    this.visible = visible;

    if (bulb) this.addBulb();
  }

  makeVisible () {
    if (!this.visible) {
      this.visible = true;
      this.sprite.visible = true;
      this.mob?.makeVisible();
    }
  }

  init () {
    this.context.rootContainer.addChild(this.sprite);
    this.mob?.init();
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
