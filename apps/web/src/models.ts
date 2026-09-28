import * as THREE from "three";
import type { CardId } from "@flashcards/shared";

/**
 * Low-poly 3D objects built from Three.js primitives: no model files to load,
 * so a card shows its object the moment it is scanned. Each model is about one
 * marker-width tall and sits on the card (y is up out of the card).
 */
export interface CardModel {
  object: THREE.Group;
  /** Idle animation; `t` is elapsed seconds. */
  update(t: number): void;
}

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, flatShading: true, ...extra });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function apple(): CardModel {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.42, 20, 14), mat(0xe63946), 0, 0.42);
  body.scale.set(1, 0.9, 1);
  const stem = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22), mat(0x6b4226), 0, 0.88);
  const leaf = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0x52b788), 0.12, 0.9);
  leaf.scale.set(1.4, 0.3, 0.7);
  leaf.rotation.z = -0.5;
  g.add(body, stem, leaf);
  return { object: g, update: (t) => (g.rotation.y = t * 0.8) };
}

function tree(): CardModel {
  const g = new THREE.Group();
  const leaves = mat(0x2d6a4f);
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.45, 8), mat(0x7f5539), 0, 0.22));
  g.add(mesh(new THREE.ConeGeometry(0.45, 0.55, 8), leaves, 0, 0.62));
  g.add(mesh(new THREE.ConeGeometry(0.35, 0.45, 8), leaves, 0, 0.92));
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.35, 8), leaves, 0, 1.18));
  return { object: g, update: (t) => (g.rotation.z = Math.sin(t * 1.5) * 0.05) };
}

function house(): CardModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.55, 0.7), mat(0xf4e1c1), 0, 0.28));
  const roof = mesh(new THREE.ConeGeometry(0.66, 0.4, 4), mat(0xc0392b), 0, 0.75);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.3, 0.02), mat(0x8d5524), 0, 0.15, 0.36));
  const glass = mat(0x8ecae6, { emissive: 0x1d3557 });
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), glass, -0.24, 0.34, 0.36));
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), glass, 0.24, 0.34, 0.36));
  return { object: g, update: (t) => (g.rotation.y = Math.sin(t * 0.6) * 0.6) };
}

function car(): CardModel {
  const g = new THREE.Group();
  const paint = mat(0x1d4ed8);
  g.add(mesh(new THREE.BoxGeometry(0.95, 0.25, 0.5), paint, 0, 0.22));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.22, 0.46), paint, -0.05, 0.45));
  g.add(mesh(new THREE.BoxGeometry(0.52, 0.16, 0.47), mat(0xbde0fe, { emissive: 0x1e3a8a }), -0.05, 0.46));
  const tyre = mat(0x222222);
  const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  for (const x of [-0.3, 0.3]) {
    for (const z of [-0.26, 0.26]) {
      const w = mesh(wheelGeo, tyre, x, 0.12, z);
      wheels.push(w);
      g.add(w);
    }
  }
  return {
    object: g,
    update: (t) => {
      g.position.x = Math.sin(t) * 0.15;
      wheels.forEach((w) => (w.rotation.z = -Math.cos(t) * 3));
    },
  };
}

function fish(): CardModel {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.35, 16, 12), mat(0xff9f1c), 0, 0);
  body.scale.set(1.3, 0.8, 0.5);
  const tail = mesh(new THREE.ConeGeometry(0.22, 0.35, 4), mat(0xf77f00), -0.55, 0);
  tail.rotation.z = Math.PI / 2;
  const eye = mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(0x111111), 0.3, 0.08, 0.15);
  const fishGroup = new THREE.Group();
  fishGroup.add(body, tail, eye);
  fishGroup.position.y = 0.5;
  g.add(fishGroup);
  return {
    object: g,
    update: (t) => {
      fishGroup.position.y = 0.5 + Math.sin(t * 2) * 0.08;
      tail.rotation.y = Math.sin(t * 8) * 0.5;
    },
  };
}

function sun(): CardModel {
  const g = new THREE.Group();
  const glow = mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.6 });
  const core = mesh(new THREE.IcosahedronGeometry(0.32, 1), glow, 0, 0.6);
  const rays = new THREE.Group();
  rays.position.y = 0.6;
  const rayGeo = new THREE.ConeGeometry(0.07, 0.2, 6);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ray = mesh(rayGeo, glow, Math.cos(a) * 0.45, Math.sin(a) * 0.45);
    ray.rotation.z = a - Math.PI / 2;
    rays.add(ray);
  }
  g.add(core, rays);
  return {
    object: g,
    update: (t) => {
      rays.rotation.z = t * 0.6;
      core.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    },
  };
}

const BUILDERS: Record<CardId, () => CardModel> = { apple, tree, house, car, fish, sun };

export const createModel = (id: CardId): CardModel => BUILDERS[id]();

export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 3, 2);
  scene.add(key);
}
