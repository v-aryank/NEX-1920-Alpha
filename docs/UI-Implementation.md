# UI implementation notes

## Vehicle rendering

`src/components/VehicleScene.tsx` creates a reference-inspired angular cyber sports car/RC buggy from project-authored Three.js geometry. It has a low wedge hull, faceted silver body panels, dark canopy, wide treaded wheels, and cyan accent lights. No external GLB, stock image, or vehicle model is loaded. A slow yaw rotation, mild body bob, pointer parallax, contact shadow, and drag-to-inspect wheel spin run in the renderer. The scene is lazy-loaded and displays a text fallback if WebGL setup fails. Reduced-motion preference suppresses idle movement.

## Mobile orientation lifecycle

`src/services/orientation.ts` checks for an actual mobile user agent plus coarse input, or a native Capacitor runtime. On a mobile Control entry, it requests landscape through the Capacitor Screen Orientation plugin on native or the browser Screen Orientation API on web. Browser fullscreen is requested only from the explicit Control action and only when supported. Unsupported or rejected browser requests show an instruction to rotate manually. Leaving Control sends STOP through the existing session lifecycle and requests portrait. Desktop exits before any orientation operation.

## Safety and telemetry

The single prominent emergency control beside the throttle joystick uses the existing STOP path and locks input until the user enables control again. The cockpit puts calculated left/right motor output around a central speed/throttle gauge; a compact radial mode menu keeps all three controller modes available without leaving their choices open. Vehicle speed and battery voltage remain blank unless received over the adapter. The firmware watchdog is shown as unknown until device support reports it; the UI does not claim firmware safety verification.
