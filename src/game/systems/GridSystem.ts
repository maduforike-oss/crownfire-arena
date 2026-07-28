import { GAME_CONFIG } from '../config/GameConfig';
import type { GridPosition, TileType, WorldPosition } from '../utils/types';
import { keyOf } from '../utils/math';
import type { MapDef } from '../config/Maps';
import { generateMapTiles } from './MapGenerationSystem';

export class GridSystem {
  readonly tiles = new Map<string, TileType>();
  readonly spawnReserved = new Set<string>();
  readonly offsetX: number;
  readonly offsetY: number;
  readonly tileSize: number;

  constructor(readonly map: MapDef) {
    this.tileSize = map.tileSize ?? GAME_CONFIG.tileSize;
    this.offsetX = (GAME_CONFIG.width - map.width * this.tileSize) / 2;
    this.offsetY = GAME_CONFIG.arenaTop;
    this.build();
  }

  private build(): void {
    const generated = generateMapTiles(this.map);
    this.tiles.clear();
    this.spawnReserved.clear();
    for (const [key, tile] of generated.tiles) this.tiles.set(key, tile);
    for (const key of generated.reserved) this.spawnReserved.add(key);
  }

  inBounds(pos: GridPosition): boolean {
    return pos.x >= 0 && pos.y >= 0 && pos.x < this.map.width && pos.y < this.map.height;
  }

  get(pos: GridPosition): TileType {
    return this.tiles.get(keyOf(pos)) ?? 'solid';
  }

  set(pos: GridPosition, tile: TileType): void {
    this.tiles.set(keyOf(pos), tile);
  }

  isWalkable(pos: GridPosition): boolean {
    return this.inBounds(pos) && this.get(pos) === 'empty';
  }

  toWorld(pos: GridPosition): WorldPosition {
    return {
      x: this.offsetX + pos.x * this.tileSize + this.tileSize / 2,
      y: this.offsetY + pos.y * this.tileSize + this.tileSize / 2
    };
  }

  toGrid(pos: WorldPosition): GridPosition {
    return {
      x: Math.floor((pos.x - this.offsetX) / this.tileSize),
      y: Math.floor((pos.y - this.offsetY) / this.tileSize)
    };
  }
}
