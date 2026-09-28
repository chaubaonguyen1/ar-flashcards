import * as THREE from "three";
import {
  ArMarkerControls,
  ArToolkitContext,
  ArToolkitSource,
} from "@ar-js-org/ar.js/three.js/build/ar-threex.mjs";
import { CARD_IDS, type CardId } from "@flashcards/shared";
import { addLights, createModel } from "./models";

const BASE = import.meta.env.BASE_URL;

export interface ArScanner {
  stop(): void;
}

/**
 * Tracks all six printed cards at once with ARToolKit (AR.js) and renders each
 * card's 3D object on top of it with Three.js.
 *
 * `demoImage` swaps the webcam for a still image of a card, so the full pipeline
 * (real marker detection included) can run on a laptop without a camera.
 */
export function startScanner(
  canvas: HTMLCanvasElement,
  handlers: { onFound(id: CardId): void; onLost(id: CardId): void; onError(message: string): void },
  demoImage?: string,
): ArScanner {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  // Drawing buffer matches the 4:3 frame ARToolKit's camera_para.dat is calibrated for;
  // copyElementSizeTo() below only stretches it with CSS to cover the screen.
  renderer.setSize(1280, 960, false);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(camera);
  addLights(scene);

  const source = new ArToolkitSource(
    demoImage ? { sourceType: "image", sourceUrl: demoImage } : { sourceType: "webcam" },
  );
  const context = new ArToolkitContext({ cameraParametersUrl: `${BASE}camera_para.dat`, detectionMode: "mono" });

  const models = CARD_IDS.map((id) => {
    const root = new THREE.Group();
    scene.add(root);
    const model = createModel(id);
    model.object.scale.setScalar(0.6); // ~60% of the card width reads well at arm's length
    root.add(model.object);
    const controls = new ArMarkerControls(context, root, {
      type: "pattern",
      patternUrl: `${BASE}markers/${id}.patt`,
      changeMatrixMode: "modelViewMatrix",
    });
    controls.addEventListener("markerFound", () => {
      if (!root.userData.tracked) {
        root.userData.tracked = true;
        handlers.onFound(id);
      }
    });
    controls.addEventListener("markerLost", () => {
      root.userData.tracked = false;
      handlers.onLost(id);
    });
    return model;
  });

  const onResize = () => {
    source.onResizeElement();
    source.copyElementSizeTo(renderer.domElement);
    if (context.arController) source.copyElementSizeTo(context.arController.canvas);
  };

  source.init(
    () => {
      // The video/image needs a frame before it reports its real size.
      setTimeout(onResize, 300);
      context.init(() => camera.projectionMatrix.copy(context.getProjectionMatrix()));
    },
    () => handlers.onError("Camera unavailable. Allow camera access, or try the demo."),
  );
  addEventListener("resize", onResize);

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    // ArMarkerControls shows/hides each card's root as its marker is found/lost.
    if (source.ready) context.update(source.domElement);
    const t = timer.getElapsed();
    for (const model of models) model.update(t);
    renderer.render(scene, camera);
  });

  return {
    stop() {
      renderer.setAnimationLoop(null);
      removeEventListener("resize", onResize);
      const el = source.domElement;
      if (el instanceof HTMLVideoElement && el.srcObject instanceof MediaStream) {
        el.srcObject.getTracks().forEach((track) => track.stop());
      }
      el?.remove();
      renderer.dispose();
    },
  };
}
