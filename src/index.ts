import { Application, Sprite, Assets, Texture, Resource, Container, BLEND_MODES, Graphics, BlurFilter, Filter, BitmapText, BitmapFont, RenderTexture, groupD8 } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Layer, Stage } from '@pixi/layers';
import Direction, { opposites, add } from './util/Direction';
import List from './util/List';
import HamiltonianBoard from './generators/HamiltonianBoard';
import GoishiHiroiBoard from './generators/GoishiHiroiBoard';
import KnightGraph, { KnightColor, Knight } from './generators/KnightGraph';
import AltarBoard from './generators/AltarBoard';
import BoardTemplate, { Terrain, Mob, KnightMob, LevelOptions, AltarMob, PileMob } from './engine/BoardTemplate';
import ActiveBoard, { PlayerState } from './engine/ActiveBoard';
import TempleGrid, { PossibleBoard, BoardType, boardTypes } from './engine/TempleGrid';

async function main() {
  const app = new Application<HTMLCanvasElement>();

  const wrapper = document.getElementById('wrapper');

  wrapper.appendChild(app.view);

  const textures = {
    chestClosed: await Assets.load('./assets/chest-closed.png'),
    chestOpen: await Assets.load('./assets/chest-open.png'),
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
  temple.generateFinite(35);

  temple.reify(temple.activeBoard);

  const playerState = new PlayerState();

  const minimap = new Container();
  const minimapContent = new Container();
  minimap.visible = false;

  minimap.addChild(minimapContent);

  const minimapMask = new Graphics();
  minimapMask.beginFill(0xffffff, 1);
  minimapMask.drawRect(0, 0, app.screen.width, app.screen.height);
  minimapMask.endFill();

  app.stage.addChild(minimapMask);

  const minimapBackground = new Graphics();
  minimapBackground.beginFill(0x808080, 0.3);
  minimapBackground.drawRect(0, 0, app.screen.width, app.screen.height);
  minimapBackground.endFill();

  const minimapScale = 3;

  const firstRoom = drawGraphic(temple.activeBoard);
  function drawGraphic(board: PossibleBoard) {
    const graphic = new Graphics();
    graphic.beginFill(0xffffff, 0.5);
    graphic.drawRect(0, 0, board.dim[0] * minimapScale, board.dim[1] * minimapScale);
    if (board.exits[Direction.left]) {
      graphic.drawRect(-minimapScale, Math.floor(board.dim[1] / 2) * minimapScale, minimapScale, minimapScale);
    }
    if (board.exits[Direction.right]) {
      graphic.drawRect(board.dim[0] * minimapScale, Math.floor(board.dim[1] / 2) * minimapScale, minimapScale, minimapScale);
    }
    if (board.exits[Direction.up]) {
      graphic.drawRect(Math.floor(board.dim[0] / 2) * minimapScale, -minimapScale, minimapScale, minimapScale);
    }
    if (board.exits[Direction.down]) {
      graphic.drawRect(Math.floor(board.dim[0] / 2) * minimapScale, board.dim[1] * minimapScale, minimapScale, minimapScale);
    }
    graphic.endFill();
    graphic.position.x = board.pos[0] * minimapScale;
    graphic.position.y = board.pos[1] * minimapScale;
    return graphic;
  }
  firstRoom.tint = 0xffffff;
  minimapContent.addChild(firstRoom);

  let currentMinimapSquare = { graphic: firstRoom, finished: false, board: temple.activeBoard };

  const minimapSquares = [currentMinimapSquare];

  minimapContent.position.x = -temple.activeBoard.dim[0] / 2 * minimapScale + app.screen.width / 2;
  minimapContent.position.y = -temple.activeBoard.dim[0] / 2 * minimapScale + app.screen.height / 2;

  minimap.addChild(minimapBackground);
  minimap.mask = minimapMask;

  app.stage.addChild(temple.activeBoard.board.room);
  app.stage.addChild(lighting);
  app.stage.addChild(lightingSprite);
  app.stage.addChild(temple.activeBoard.board.textWrapper);
  app.stage.addChild(minimap);

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

  let animationVector: [number, number] | null = null;
  let animationStart: [number, number] | null = null;
  let animating = false;
  let animationCallback: (() => void) | null = null;
  let animationCounter = 0;

  async function animateActiveBoard(start: [number, number], vector: [number, number]) {
    animating = true;
    animationStart = start;
    animationVector = vector;
    animationCounter = 0;

    await new Promise<void>((resolve) => animationCallback = () => resolve());
  }

  document.body.addEventListener('keydown', async (event) => {
    keysdown[event.key] = true;
    const keyMap = {
      [Direction.up]: 'ArrowUp',
      [Direction.down]: 'ArrowDown',
      [Direction.right]: 'ArrowRight',
      [Direction.left]: 'ArrowLeft',
    };

    if (animating) return;

    const exited = (await Promise.all((Object.keys(keyMap) as Direction[]).map(async (key) => {
      const { activeBoard } = temple;
      if ((activeBoard.startDir === key || activeBoard.board.finished) && isAtDoor(key) && keyMap[key] === event.key) {
        const exit = activeBoard.exits[key];
        if (!exit) return false;

        await animateActiveBoard([0, 0], add(0, 0, opposites[key]));

        app.stage.removeChild(activeBoard.board.room);
        app.stage.removeChild(activeBoard.board.textWrapper);
        app.stage.removeChild(lightingSprite);
        app.stage.removeChild(minimap);
        
        const { graphic } = currentMinimapSquare;
        graphic.tint = activeBoard.board.finished ? 0x00ff00 : 0xff0000;
        temple.activeBoard = exit;

        if (!exit.board) {
          temple.reify(exit);
        }

        if (!exit.board) throw new Error('type narrowing');
          
        currentMinimapSquare = minimapSquares.find((s) => s.board === exit);

        if (!currentMinimapSquare) {
          const minimapGraphic = drawGraphic(temple.activeBoard);
          minimapContent.addChild(minimapGraphic);

          currentMinimapSquare = { graphic: minimapGraphic, finished: false, board: temple.activeBoard };

          minimapSquares.push(currentMinimapSquare);

          minimapContent.position.x = -minimapGraphic.position.x + app.screen.width / 2;
          minimapContent.position.y = -minimapGraphic.position.y + app.screen.height / 2;
        }

        const { graphic: newGraphic } = currentMinimapSquare;

        newGraphic.tint = 0xffffff;

        minimapContent.position.x = -newGraphic.position.x + app.screen.width / 2;
        minimapContent.position.y = -newGraphic.position.y + app.screen.height / 2;

        app.stage.addChild(temple.activeBoard.board.room);
        app.stage.addChild(lightingSprite);
        app.stage.addChild(temple.activeBoard.board.textWrapper);
        app.stage.addChild(minimap);

        await animateActiveBoard(add(0, 0, key), [0, 0]);

        return true;
      }
    }))).some((x) => x);

    if (event.key === 'm') {
      minimap.visible = !minimap.visible
    }
    else if (!exited) {
      temple.activeBoard.board.handleKeys(keysdown, playerState);
    }
  });
  document.body.addEventListener('keyup', (event) => {
    keysdown[event.key] = false;
  });

  app.ticker.add((delta) => {
    const { activeBoard } = temple;

    if (animating) {
      activeBoard.board.room.position.x = app.screen.width / 2 - activeBoard.board.player.x
        + animationStart[0] * (1 - animationCounter) * app.screen.width
        + animationVector[0] * animationCounter * app.screen.width;
      activeBoard.board.room.position.y = app.screen.height / 2 - activeBoard.board.player.y
        + animationStart[1] * (1 - animationCounter) * app.screen.height
        + animationVector[1] * animationCounter * app.screen.height;

      lighting.position.x = app.screen.width / 2 - activeBoard.board.player.x
        + animationStart[0] * (1 - animationCounter) * app.screen.width
        + animationVector[0] * animationCounter * app.screen.width;
      lighting.position.y = app.screen.height / 2 - activeBoard.board.player.y
        + animationStart[1] * (1 - animationCounter) * app.screen.height
        + animationVector[1] * animationCounter * app.screen.height;

      animationCounter += delta * 0.1;

      if (animationCounter > 1) {
        animating = false;
        if (animationCallback) animationCallback();
      }
    } else {
      activeBoard.board.room.position.x = app.screen.width / 2 - activeBoard.board.player.x;
      activeBoard.board.room.position.y = app.screen.height / 2 - activeBoard.board.player.y;

      lighting.position.x = app.screen.width / 2 - activeBoard.board.player.x;
      lighting.position.y = app.screen.height / 2 - activeBoard.board.player.y;
    }

    activeBoard.board.tick(delta, keysdown);
  });
}

main();
