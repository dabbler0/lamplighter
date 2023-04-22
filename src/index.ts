import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites } from './util/Direction';
import List from './util/List';
import HamiltonianBoard from './generators/HamiltonianBoard';
import GoishiHiroiBoard from './generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from './generators/KnightGraph';
import AltarBoard from './generators/AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob } from './engine/BoardTemplate';
import ActiveBoard from './engine/ActiveBoard';
import TempleGrid, { ReifiedBoard, UnreifiedBoard, BoardType, boardTypes } from './engine/TempleGrid';

async function main() {
  const app = new Application<HTMLCanvasElement>();

  document.body.appendChild(app.view);

  const textures = {
    face: await Assets.load('./assets/face.png'),
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

  const opts = {
    textures,
    scale: 40,
    app,
    blurFilter: blur,
    lightingLayer: lighting,
  };

  const temple = new TempleGrid(opts);

  app.stage.addChild(temple.activeBoard.board.room);
  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);
  app.stage.addChild(temple.activeBoard.board.textWrapper);

  lighting.position.x = app.screen.width / 2 - temple.activeBoard.board.player.x;
  lighting.position.y = app.screen.height / 2 - temple.activeBoard.board.player.y;

  function isAtDoor(dir: Direction) {
    const { activeBoard } = temple;

    if (dir === Direction.up) {
      return activeBoard.board.pos[0] === Math.floor(activeBoard.board.width / 2) &&
        activeBoard.board.pos[1] === 0;
    } else if (dir === Direction.down) {
      return activeBoard.board.pos[0] === Math.floor(activeBoard.board.width / 2) &&
        activeBoard.board.pos[1] === activeBoard.board.height - 1;
    } else if (dir === Direction.right) {
      return activeBoard.board.pos[1] === Math.floor(activeBoard.board.height / 2) &&
        activeBoard.board.pos[0] === activeBoard.board.width - 1;
    } else if (dir === Direction.left) {
      return activeBoard.board.pos[1] === Math.floor(activeBoard.board.height / 2) &&
        activeBoard.board.pos[0] === 0;
    }
  }

  document.body.addEventListener('keydown', (event) => {
    keysdown[event.key] = true;
    const keyMap = {
      [Direction.up]: 'ArrowUp',
      [Direction.down]: 'ArrowDown',
      [Direction.right]: 'ArrowRight',
      [Direction.left]: 'ArrowLeft',
    };

    const exited = (Object.keys(keyMap) as Direction[]).map((key) => {
      const { activeBoard } = temple;
      if ((activeBoard.startDir === key || activeBoard.board.finished) && isAtDoor(key) && keyMap[key] === event.key) {
        const exit = activeBoard.exits[key];
        if (!exit) return false;

        app.stage.removeChild(activeBoard.board.room);
        app.stage.removeChild(activeBoard.board.textWrapper);
        app.stage.removeChild(lightingSprite);

        if (exit instanceof UnreifiedBoard) {
          const newBoard = temple.reify(exit, opposites[key], activeBoard);
          temple.activeBoard.exits[key] = newBoard;
          temple.activeBoard = newBoard;
        }
        else if (exit instanceof ReifiedBoard) {
          temple.activeBoard = exit;
        }
        app.stage.addChild(temple.activeBoard.board.room);
        app.stage.addChild(lightingSprite);
        app.stage.addChild(temple.activeBoard.board.textWrapper);

        return true;
      }
    }).some((x) => x);

    if (!exited) {
      temple.activeBoard.board.handleKeys(keysdown);
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  app.ticker.add((delta) => {
    const { activeBoard } = temple;
    activeBoard.board.room.position.x = app.screen.width / 2 - activeBoard.board.player.x;
    activeBoard.board.room.position.y = app.screen.height / 2 - activeBoard.board.player.y;

    lighting.position.x = app.screen.width / 2 - activeBoard.board.player.x;
    lighting.position.y = app.screen.height / 2 - activeBoard.board.player.y;

    activeBoard.board.tick(delta, keysdown);
  });
}

main();
