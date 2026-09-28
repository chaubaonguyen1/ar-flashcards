// AR.js ships no type definitions; these cover only the surface this app uses.
declare module "@ar-js-org/ar.js/three.js/build/ar-threex.mjs" {
  import type { Matrix4, Object3D } from "three";

  export class ArToolkitSource {
    constructor(params: { sourceType: "webcam" | "image"; sourceUrl?: string });
    domElement: HTMLVideoElement | HTMLImageElement;
    ready: boolean;
    init(onReady: () => void, onError?: (error: unknown) => void): void;
    onResizeElement(): void;
    copyElementSizeTo(element: HTMLElement): void;
  }

  export class ArToolkitContext {
    constructor(params: { cameraParametersUrl: string; detectionMode: "mono" | "color" });
    arController: { canvas: HTMLCanvasElement } | null;
    init(onCompleted: () => void): void;
    getProjectionMatrix(): Matrix4;
    update(source: HTMLVideoElement | HTMLImageElement): boolean;
  }

  export class ArMarkerControls {
    constructor(
      context: ArToolkitContext,
      object3d: Object3D,
      params: { type: "pattern"; patternUrl: string; changeMatrixMode?: "modelViewMatrix" | "cameraTransformMatrix" },
    );
    addEventListener(event: "markerFound" | "markerLost", handler: () => void): void;
  }
}
