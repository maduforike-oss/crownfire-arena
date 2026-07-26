export type GameAction = 'up' | 'down' | 'left' | 'right' | 'bomb' | 'special' | 'remote' | 'pause';

export interface ActionBinding {
  keyboardCodes: string[];
  gamepadButtons: number[];
}

export type InputBindings = Record<GameAction, ActionBinding>;

const STORAGE_KEY = 'crownfire-controller-bindings-v1';

export const ACTIONS: GameAction[] = ['up', 'down', 'left', 'right', 'bomb', 'special', 'remote', 'pause'];

export const DEFAULT_BINDINGS: InputBindings = {
  up: { keyboardCodes: ['KeyW', 'ArrowUp'], gamepadButtons: [12] },
  down: { keyboardCodes: ['KeyS', 'ArrowDown'], gamepadButtons: [13] },
  left: { keyboardCodes: ['KeyA', 'ArrowLeft'], gamepadButtons: [14] },
  right: { keyboardCodes: ['KeyD', 'ArrowRight'], gamepadButtons: [15] },
  bomb: { keyboardCodes: ['Space', 'Enter', 'NumpadEnter'], gamepadButtons: [0] },
  special: { keyboardCodes: ['ShiftLeft', 'ShiftRight'], gamepadButtons: [1] },
  remote: { keyboardCodes: ['KeyE', 'KeyP'], gamepadButtons: [2] },
  pause: { keyboardCodes: ['Escape'], gamepadButtons: [9] }
};

function cloneDefaults(): InputBindings {
  return Object.fromEntries(ACTIONS.map((action) => [
    action,
    {
      keyboardCodes: [...DEFAULT_BINDINGS[action].keyboardCodes],
      gamepadButtons: [...DEFAULT_BINDINGS[action].gamepadButtons]
    }
  ])) as InputBindings;
}

export function loadInputBindings(): InputBindings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<InputBindings>;
    const result = cloneDefaults();
    for (const action of ACTIONS) {
      if (saved[action]?.keyboardCodes?.length) result[action].keyboardCodes = [...saved[action]!.keyboardCodes];
      if (saved[action]?.gamepadButtons?.length) result[action].gamepadButtons = [...saved[action]!.gamepadButtons];
    }
    return result;
  } catch {
    return cloneDefaults();
  }
}

export function saveInputBindings(bindings: InputBindings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function resetInputBindings(): InputBindings {
  const defaults = cloneDefaults();
  saveInputBindings(defaults);
  return defaults;
}

export function bindingLabel(binding: ActionBinding): string {
  const keys = binding.keyboardCodes.map((code) => code.replace('Key', '').replace('Arrow', ''));
  const pads = binding.gamepadButtons.map((button) => `Pad ${button}`);
  return [...keys, ...pads].join(' / ');
}
