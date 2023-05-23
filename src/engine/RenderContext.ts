import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { Layer, Stage } from '@pixi/layers';

export default class RenderContext {
  blur: Filter;
  lightingLayer: Layer;
  stage: Stage;
  player: Sprite;
  rootContainer: Container;
  scale: number;
  textures: Record<string, Texture>;

  constructor({
    blur, lightingLayer, stage, rootContainer, scale,
    textures, player,
  }: {
    blur: Filter;
    lightingLayer: Layer;
    stage: Stage;
    rootContainer: Container;
    scale: number;
    textures: Record<string, Texture>;
    player: Sprite;
  }) {
    this.blur = blur;
    this.lightingLayer = lightingLayer;
    this.stage = stage;
    this.rootContainer = rootContainer;
    this.scale = scale;
    this.textures = textures;
    this.player = player;

    rootContainer.sortableChildren = true;
    player.zIndex = 0;

    rootContainer.addChild(player);
  }
}
