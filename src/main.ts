import Phaser from 'phaser';
import './style.css';
import { GAME_CONFIG } from './game/config/GameConfig';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { CharacterSelectScene } from './game/scenes/CharacterSelectScene';
import { ModeSelectScene } from './game/scenes/ModeSelectScene';
import { MapSelectScene } from './game/scenes/MapSelectScene';
import { GameScene } from './game/scenes/GameScene';
import { ResultsScene } from './game/scenes/ResultsScene';
import { PowerUpGuideScene } from './game/scenes/PowerUpGuideScene';
import { ControllerSetupScene } from './game/scenes/ControllerSetupScene';
import { registerServiceWorker } from './game/systems/PWAInstall';
import { installDevicePresentation } from './game/systems/DeviceProfile';

registerServiceWorker();
installDevicePresentation();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: '#101015',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  input: {
    activePointers: 4,
    touch: { capture: true }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    CharacterSelectScene,
    ModeSelectScene,
    MapSelectScene,
    PowerUpGuideScene,
    ControllerSetupScene,
    GameScene,
    ResultsScene
  ]
});
