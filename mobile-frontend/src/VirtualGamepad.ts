/**
 * Virtual gamepad implementing the W3C Gamepad interface.
 * Registered with the GameLift Streams SDK via addGamepad().
 * Touch controls mutate axes/buttons directly, then processGamepads() is called.
 * Index 200 avoids conflicts with real gamepads (which use 0-3).
 */
export class VirtualGamepad implements Gamepad {
  readonly id = 'virtual-gamepad';
  readonly index = 200;
  readonly connected = true;
  readonly mapping: GamepadMappingType = '';
  get timestamp() { return performance.now(); }
  readonly hapticActuators: readonly GamepadHapticActuator[] = [];
  readonly vibrationActuator: GamepadHapticActuator | null = null;

  // 4 axes: left stick X, left stick Y, right stick X, right stick Y
  axes: number[] = [0, 0, 0, 0];

  // 17 standard buttons (matches standard gamepad layout)
  buttons: GamepadButton[] = Array.from({ length: 17 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));

  setAxis(index: number, value: number) {
    this.axes[index] = Math.max(-1, Math.min(1, value));
  }

  setButton(index: number, pressed: boolean) {
    this.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
  }
}
