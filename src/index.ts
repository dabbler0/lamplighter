import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites, add } from './util/Direction';
import List from './util/List';
import HamiltonianBoard from './generators/HamiltonianBoard';
import GoishiHiroiBoard from './generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from './generators/KnightGraph';
import AltarBoard from './generators/AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob, BoardType, boardTypes } from './engine/BoardTemplate';
import TempleGrid from './engine/TempleGrid';
import RenderContext from './engine/RenderContext';
import PossibleBoard from './engine/PossibleBoard';
import PlayerState from './engine/PlayerState';

async function main() {
  const app = new Application<HTMLCanvasElement>();

  const wrapper = document.getElementById('wrapper');

  wrapper.appendChild(app.view);

  const textures = {
    chestClosed: await Assets.load('./assets/chest-closed.png'),
    chestOpen: await Assets.load('./assets/chest-open.png'),
    face: await Assets.load('./assets/face.png'),
    grass: await Assets.load('./assets/grass.png'),
    back: await Assets.load('./assets/back.png'),
    right1: await Assets.load('./assets/side.png'),
    left1: (await Assets.load('./assets/side.png')).clone(),
    right2: await Assets.load('./assets/side2.png'),
    left2: (await Assets.load('./assets/side2.png')).clone(),
    platform: await Assets.load('./assets/platform.png'),
    platformBroken: await Assets.load('./assets/platform-broken.png'),
    bridge: await Assets.load('./assets/bridge.png'),
    stoneTop: await Assets.load('./assets/stone-top.png'),
    stoneGo: await Assets.load('./assets/stone-go.png'),
    stoneGoDown: await Assets.load('./assets/stone-go-down.png'),
    stoneGoRight: await Assets.load('./assets/stone-go-right.png'),
    stoneGoLeft: await Assets.load('./assets/stone-go-left.png'),
    stoneStop: await Assets.load('./assets/stone-stop.png'),
    stoneStopDown: await Assets.load('./assets/stone-stop-down.png'),
    stoneStopLeft: await Assets.load('./assets/stone-stop-left.png'),
    stoneStopRight: await Assets.load('./assets/stone-stop-right.png'),
    stonePurple: await Assets.load('./assets/stone-purple.png'),
    stoneMid: await Assets.load('./assets/stone-mid.png'),
    stoneUnder: await Assets.load('./assets/stone-under.png'),
    lightTop: await Assets.load('./assets/light-top.png'),
    lightMid: await Assets.load('./assets/light-mid.png'),
    litTop: await Assets.load('./assets/lit-top.png'),
    litMid: await Assets.load('./assets/lit-mid.png'),
    water1: await Assets.load('./assets/water1.png'),
    water2: await Assets.load('./assets/water2.png'),
    water3: await Assets.load('./assets/water3.png'),
    water4: await Assets.load('./assets/water4.png'),
    door: await Assets.load('./assets/door.png'),
    redKnight: await Assets.load('./assets/red-knight.png'),
    blueKnight: await Assets.load('./assets/blue-knight.png'),
    greenKnight: await Assets.load('./assets/green-knight.png'),
    ice: await Assets.load('./assets/ice.png'),
    unusedIceRune: await Assets.load('./assets/ice-rune-unused.png'),
    usedIceRune: await Assets.load('./assets/ice-rune-used.png'),
    orbs4: await Assets.load('./assets/orbs-4.png'),
    orbs2: await Assets.load('./assets/orbs-2.png'),
    orbs1: await Assets.load('./assets/orbs-1.png'),
  };

  textures.left1.rotate = groupD8.MIRROR_HORIZONTAL;
  textures.left2.rotate = groupD8.MIRROR_HORIZONTAL;

  app.stage = new Stage();

  const rootContainer = new Container();
  app.stage.addChild(rootContainer);

  const lighting = new Layer();
  const blur = new BlurFilter(20);
  const smallBlur = new BlurFilter();

  (lighting as any).on('display', (element: any) => {
    element.blendMode = BLEND_MODES.ADD;
  });

  lighting.useRenderTexture = true;
  lighting.clearColor = [0.2, 0.2, 0.2, 1]; // ambient gray

  const lightingSprite = new Sprite(lighting.getRenderTexture());
  lightingSprite.blendMode = BLEND_MODES.MULTIPLY;

  BitmapFont.from("TitleFont", {
    fill: "#ffffff",
    fontSize: 15,
    padding: 0,
    lineHeight: 15,
    fontWeight: 'bold',
  }, {
    chars: BitmapFont.ASCII
  });

  const keysdown: Record<string, boolean> = {};

  const player = new Sprite(textures.face);
  player.scale.x = 40 / 200;
  player.scale.y = 40 / 200;
  player.zIndex = 0;
  rootContainer.addChild(player);

  const temple = new TempleGrid(new RenderContext({
    textures,
    scale: 40,
    stage: app.stage as Stage,
    blur,
    player,
    rootContainer,
    lightingLayer: lighting,
    app,
  }));
  temple.generateFinite(35);

  const playerState = new PlayerState();

  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);

  lighting.position.x = app.screen.width / 2 - player.position.x;
  lighting.position.y = app.screen.height / 2 - player.position.y;

  let alreadyMoving = false;

  document.body.addEventListener('keydown', async (event) => {
    keysdown[event.key] = true;
    const keyMap = {
      [Direction.up]: 'ArrowUp',
      [Direction.down]: 'ArrowDown',
      [Direction.right]: 'ArrowRight',
      [Direction.left]: 'ArrowLeft',
    };

    Object.values(Direction).forEach(async (dir) => {
      if (event.key === keyMap[dir] && !alreadyMoving) {
        alreadyMoving = true;
        await temple.applyMove(playerState, dir);

        player.position.x = playerState.pos[0] * 40;
        player.position.y = playerState.pos[1] * 40;
        player.zIndex = playerState.pos[1] + 1;
        alreadyMoving = false;
      }
    });
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  app.ticker.add((delta) => {
    temple.tick(delta);

    rootContainer.position.x = app.screen.width / 2 - player.position.x;
    rootContainer.position.y = app.screen.height / 2 - player.position.y;

    lighting.position.x = app.screen.width / 2 - player.position.x;
    lighting.position.y = app.screen.height / 2 - player.position.y;
  });
}

main();
