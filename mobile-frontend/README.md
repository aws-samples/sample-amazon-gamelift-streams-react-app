# Amazon GameLift Streams Mobile Frontend

A mobile-optimized Progressive Web App (PWA) frontend for Amazon GameLift Streams. This project shares the same serverless backend (Cognito + API Gateway + Lambda) deployed by the main CDK stacks but provides a touch-first, always-fullscreen experience designed specifically for mobile devices.

## Key Differences from the Web Frontend

The desktop web frontend (`amazon-gamelift-streams-react-starter-frontend/`) is designed for mouse and keyboard on a desktop browser. Running a game stream on mobile introduces several platform constraints that require different solutions:

| Concern | Web Frontend | Mobile Frontend |
|---------|-------------|-----------------|
| **Fullscreen** | Uses `element.requestFullscreen()` | iOS has no Fullscreen API. Video fills viewport via CSS (`position: fixed; inset: 0`) combined with PWA standalone mode. |
| **Orientation** | Not relevant (desktop) | PWA manifest locks to landscape on Android. iOS ignores manifest orientation, so a "rotate your device" prompt is shown in portrait. |
| **Input** | Mouse, keyboard, physical gamepad | Virtual on-screen gamepad (dual joysticks + face buttons) registered with the SDK via `addGamepad`/`processGamepads`. |
| **Browser chrome** | Acceptable (URL bar, tabs) | Must be eliminated. PWA `display: standalone` removes all browser UI. `viewport-fit: cover` extends content behind notch/status bar. |
| **Pointer lock** | `autoPointerLock: 'fullscreen'` captures mouse | Disabled (`autoPointerLock: 'none'`). Touch input doesn't use pointer lock. |
| **Keyboard lock** | `navigator.keyboard.lock()` for Escape key | Not applicable on mobile. |
| **UI during stream** | Form fields, buttons, stats overlay visible | All UI hidden during streaming except the virtual gamepad and a small stop button. Setup form is a separate screen shown before streaming begins. |
| **Installation** | Regular website | Installable PWA with service worker, manifest, and iOS `apple-mobile-web-app-capable` meta tag. |

### Why These Differences Exist

**No Fullscreen API on iOS.** Safari on iOS does not implement `Element.requestFullscreen()`. The only way to remove browser UI is to run as an installed PWA in standalone mode. Even then, the status bar remains visible -- `viewport-fit: cover` with `black-translucent` status bar style lets content render behind it.

**No orientation lock on iOS.** The Screen Orientation API's `lock()` method is not implemented on iOS Safari. The PWA manifest `orientation` field is also ignored. The only cross-platform solution that preserves correct touch coordinates is prompting the user to rotate physically. CSS rotation (`transform: rotate(90deg)`) was rejected because it breaks touch event coordinate mapping for game streaming.

**Touch devices need virtual controls.** Without a physical gamepad, on-screen controls are required. The GameLift Streams Web SDK supports virtual gamepads through the same `addGamepad`/`processGamepads` API used for physical controllers. The `VirtualGamepad` class implements the W3C Gamepad interface with mutable axes and buttons that are updated on touch events.

## Architecture Decisions

### 1. Separate Project

The mobile experience requires a fundamentally different UX paradigm: touch-first interaction, always-fullscreen streaming, and virtual on-screen controls. Rather than bolting responsive design onto the desktop frontend, a separate codebase keeps both frontends simple and focused on their target platform.

### 2. PWA with Standalone Display

The PWA manifest uses `"display": "standalone"` to remove browser chrome and maximize screen real estate for game streaming. On Android, the manifest `orientation` field forces landscape mode. On iOS, standalone mode removes the Safari UI elements.

### 3. iOS Fullscreen Override

iOS Safari does not support the Fullscreen API. Instead, the video/stream element fills the viewport using CSS (`position: fixed; inset: 0`). Combined with standalone PWA mode (which removes Safari UI), this achieves near-fullscreen on iOS without relying on unavailable browser APIs.

### 4. Virtual Gamepad Overlay

Touch devices lack physical game controllers. On-screen virtual controls use `react-joystick-component` for analog sticks and custom touch buttons. The GameLift Streams Web SDK's `addGamepad`/`processGamepads` API allows registering a virtual gamepad that the streamed application sees as a standard controller input.

### 5. Same Backend

This frontend connects to the identical API stack (Cognito + API Gateway + Lambda) deployed by the main project's CDK stacks. No backend changes or additional infrastructure are needed.

## Prerequisites

- Node.js v18 or above
- npm
- Amazon GameLift Streams Web SDK (downloaded separately from the [Getting Started page](https://aws.amazon.com/gamelift/streams/getting-started/#Resources))
- A deployed API stack from the main project (`AmazonGameliftStreamsReactStarterAPIStack`)

## Setup

1. Install dependencies:
   ```bash
   cd mobile-frontend
   npm install
   ```

2. Copy the GameLift Streams Web SDK files (`.d.ts`, `.js`, `.mjs`, and `LICENSE.txt`) into `src/gamelift-streams-websdk/`.

3. Update the Amplify configuration in `src/App.tsx` with your deployed Cognito User Pool ID, Client ID, and API endpoint (same values as the desktop frontend).

4. Run locally:
   ```bash
   npm start
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Deployment

This project reuses the same CDK frontend stack class as the desktop frontend. The stack is instantiated in `bin/amazon-gamelift-streams-react-starter.ts` with `buildAssetPath: './mobile-frontend/build'`.

```bash
# From the repository root, after building:
cdk deploy AmazonGameliftStreamsReactStarterMobileFrontendStack
```

This deploys its own S3 bucket, CloudFront distribution, and WAF to `us-east-1` -- the same infrastructure pattern as the desktop frontend, just serving different build assets. The CloudFront domain will be output after deployment.
