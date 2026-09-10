import * as THREE from 'three';

const stage = document.querySelector('three-d-stage');
const { THREE: T } = await stage.ready;

/* ---------- units ---------- */
const FT = 0.3048;
const BW = 200 * FT;   // 60.96 m  (X)
const BD = 100 * FT;   // 30.48 m  (Z)
const HX = BW / 2, HZ = BD / 2;

/* ---------- materials ---------- */
const M = {
  concrete: new T.MeshStandardMaterial({ name: 'concrete', color: 0xb5b0a6, roughness: 0.95, metalness: 0.0 }),
  steel:    new T.MeshStandardMaterial({ name: 'steel',    color: 0x9aa0a6, roughness: 0.45, metalness: 0.35 }),
  machine:  new T.MeshStandardMaterial({ name: 'machine_green', color: 0x2e6b56, roughness: 0.5,  metalness: 0.25 }),
  yellow:   new T.MeshStandardMaterial({ name: 'safety_yellow', color: 0xd8a41c, roughness: 0.6,  metalness: 0.1 }),
  belt:     new T.MeshStandardMaterial({ name: 'belt_rubber',   color: 0x2c2d31, roughness: 0.92, metalness: 0.0 }),
  orange:   new T.MeshStandardMaterial({ name: 'sorter_orange', color: 0xc25422, roughness: 0.55, metalness: 0.15 }),
};

const root = new T.Group();
root.name = 'MRF_Plant';

function mesh(geo, mat, name, x = 0, y = 0, z = 0, parent = root) {
  const m = new T.Mesh(geo, mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, name, x, y, z, p) => mesh(new T.BoxGeometry(w, h, d), mat, name, x, y, z, p);
const cyl = (r, h, mat, name, x, y, z, seg = 24, p) => mesh(new T.CylinderGeometry(r, r, h, seg), mat, name, x, y, z, p);

/* ---------- building shell ---------- */
function building() {
  const g = new T.Group(); g.name = 'building'; root.add(g);
  const slab = box(BW, 0.25, BD, M.concrete, 'floor_slab', 0, -0.125, 0, g);
  slab.castShadow = false;

  const wh = 2.6, wt = 0.35;
  box(BW, wh, wt, M.concrete, 'wall_north', 0, wh / 2, -HZ + wt / 2, g);
  box(BW, wh, wt, M.concrete, 'wall_south', 0, wh / 2,  HZ - wt / 2, g);
  box(wt, wh, BD, M.concrete, 'wall_west', -HX + wt / 2, wh / 2, 0, g);
  box(wt, wh, BD, M.concrete, 'wall_east',  HX - wt / 2, wh / 2, 0, g);

  const bays = 8, eave = 9.0;
  for (let i = 0; i <= bays; i++) {
    const x = -HX + (BW * i) / bays;
    for (const z of [-HZ + 0.3, HZ - 0.3]) {
      box(0.42, eave, 0.42, M.steel, `column_${i}_${z < 0 ? 'n' : 's'}`, x, eave / 2, z, g);
    }
    box(0.3, 0.35, BD, M.steel, `truss_chord_${i}`, x, eave + 0.2, 0, g);
    const rise = 1.9;
    for (const s of [-1, 1]) {
      const rl = Math.hypot(HZ, rise);
      const r = box(0.28, 0.28, rl, M.steel, `truss_rafter_${i}_${s > 0 ? 'a' : 'b'}`, x, eave + 0.2 + rise / 2, s * HZ / 2, g);
      r.rotation.x = s * Math.atan2(rise, HZ);
    }
    box(0.35, rise, 0.35, M.steel, `truss_post_${i}`, x, eave + 0.2 + rise / 2, 0, g);
  }
  for (const z of [-HZ + 0.3, HZ - 0.3]) box(BW, 0.4, 0.3, M.steel, `eave_beam_${z < 0 ? 'n' : 's'}`, 0, eave + 0.2, z, g);
  return g;
}

/* ---------- conveyor (axis-aligned runs only) ---------- */
function conveyor(name, a, b, w = 1.2, opts = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const horiz = Math.hypot(dx, dz), len = Math.hypot(horiz, dy);
  const g = new T.Group(); g.name = name; root.add(g);
  g.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.rotation.order = 'YZX';
  g.rotation.y = Math.atan2(-dz, dx);
  g.rotation.z = Math.atan2(dy, horiz);

  box(len, 0.10, w, M.belt, `${name}_belt`, 0, 0, 0, g);
  box(len, 0.30, w + 0.12, M.steel, `${name}_frame`, 0, -0.24, 0, g);
  for (const s of [-1, 1]) box(len, 0.34, 0.09, M.yellow, `${name}_skirt_${s > 0 ? 'a' : 'b'}`, 0, 0.20, s * (w / 2 + 0.05), g);
  for (const s of [-1, 1]) {
    const p = cyl(w * 0.13, w, M.steel, `${name}_pulley_${s > 0 ? 'head' : 'tail'}`, s * (len / 2 - 0.1), -0.05, 0, 18, g);
    p.rotation.x = Math.PI / 2;
  }
  if (opts.hood) box(len * 0.98, 0.55, w + 0.2, M.machine, `${name}_hood`, 0, 0.45, 0, g);

  const n = Math.max(2, Math.round(len / 5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = a.x + dx * t, py = a.y + dy * t, pz = a.z + dz * t;
    if (py < 1.1) continue;
    for (const s of [-1, 1]) {
      const perp = new T.Vector3(-dz, 0, dx).normalize().multiplyScalar(s * (w / 2));
      box(0.16, py - 0.45, 0.16, M.steel, `${name}_leg_${i}_${s > 0 ? 'a' : 'b'}`,
        px + perp.x, (py - 0.45) / 2, pz + perp.z);
    }
  }
  return g;
}

/* ---------- platform with rails + stair ---------- */
function platform(name, x0, z0, x1, z1, h, stairSide = 'w') {
  const g = new T.Group(); g.name = name; root.add(g);
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(w, 0.14, d, M.steel, `${name}_deck`, cx, h, cz, g);
  for (const [ex, ez] of [[x0, cz], [x1, cz], [cx, z0], [cx, z1]]) {
    const isX = ez === cz;
    const L = isX ? d : w;
    box(isX ? 0.08 : L, 0.06, isX ? L : 0.08, M.yellow, `${name}_rail_top_${ex}_${ez}`, ex, h + 1.1, ez, g);
    box(isX ? 0.08 : L, 0.06, isX ? L : 0.08, M.yellow, `${name}_rail_mid_${ex}_${ez}`, ex, h + 0.6, ez, g);
    const posts = Math.max(2, Math.round(L / 1.8));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      box(0.07, 1.1, 0.07, M.yellow, `${name}_post_${ex}_${ez}_${i}`,
        isX ? ex : x0 + w * t, h + 0.55, isX ? z0 + d * t : ez, g);
    }
  }
  const sx = stairSide === 'w' ? x0 - 0.1 : x1 + 0.1, dir = stairSide === 'w' ? -1 : 1;
  const run = h * 1.15;
  const st = box(run, 0.12, 1.1, M.steel, `${name}_stair`, sx + dir * run / 2, h / 2, cz, g);
  st.rotation.z = -dir * Math.atan2(h, run);
  for (const s of [-1, 1]) {
    const r = box(run, 0.06, 0.06, M.yellow, `${name}_stair_rail_${s > 0 ? 'a' : 'b'}`, sx + dir * run / 2, h / 2 + 1.0, cz + s * 0.55, g);
    r.rotation.z = -dir * Math.atan2(h, run);
  }
  return g;
}

/* ---------- bunker (three concrete walls) ---------- */
function bunker(name, cx, cz, w, d, open = 's', h = 3.0) {
  const g = new T.Group(); g.name = name; root.add(g);
  const t = 0.3;
  const walls = { n: [w, h, t, cx, h / 2, cz - d / 2], s: [w, h, t, cx, h / 2, cz + d / 2],
                  w: [t, h, d, cx - w / 2, h / 2, cz], e: [t, h, d, cx + w / 2, h / 2, cz] };
  for (const k of Object.keys(walls)) {
    if (k === open) continue;
    const [a, b, c, x, y, z] = walls[k];
    box(a, b, c, M.concrete, `${name}_wall_${k}`, x, y, z, g);
  }
  return g;
}

/* ---------- disc screen (always runs along X) ---------- */
function discScreen(name, cx, cz, y, len, w, angleDeg = 8, dir = 1) {
  const g = new T.Group(); g.name = name; root.add(g);
  g.position.set(cx, y, cz);
  g.rotation.z = dir * THREE.MathUtils.degToRad(angleDeg);
  const h = 1.3;
  for (const s of [-1, 1]) box(len, h, 0.14, M.machine, `${name}_side_${s > 0 ? 'a' : 'b'}`, 0, 0, s * (w / 2), g);
  box(0.16, h, w, M.machine, `${name}_end_in`, -len / 2, 0, 0, g);
  box(0.16, h, w, M.machine, `${name}_end_out`, len / 2, 0, 0, g);
  box(len, 0.14, w, M.steel, `${name}_pan`, 0, -h / 2 + 0.1, 0, g);
  const shafts = Math.max(4, Math.round(len / 0.75));
  for (let i = 0; i < shafts; i++) {
    const x = -len / 2 + 0.5 + i * ((len - 1.0) / (shafts - 1));
    const sh = cyl(0.05, w, M.steel, `${name}_shaft_${i}`, x, -0.15, 0, 12, g);
    sh.rotation.x = Math.PI / 2;
    const discs = Math.max(3, Math.round(w / 0.45));
    for (let j = 0; j < discs; j++) {
      const z = -w / 2 + 0.3 + j * ((w - 0.6) / (discs - 1));
      const d = cyl(0.21, 0.07, M.orange, `${name}_disc_${i}_${j}`, x, -0.15, z, 14, g);
      d.rotation.x = Math.PI / 2;
    }
  }
  cyl(0.28, 0.7, M.steel, `${name}_drive`, len / 2 - 0.6, -0.1, w / 2 + 0.5, 18, g).rotation.z = Math.PI / 2;
  box(0.8, 1.0, 0.6, M.machine, `${name}_gearbox`, len / 2 - 0.6, 0.45, w / 2 + 0.5, g);
  for (const ex of [-len / 2 + 0.5, len / 2 - 0.5]) {
    for (const s of [-1, 1]) {
      const ly = y + ex * Math.tan(dir * THREE.MathUtils.degToRad(angleDeg)) - h / 2;
      box(0.18, ly, 0.18, M.steel, `${name}_leg_${ex > 0 ? 'b' : 'a'}_${s > 0 ? 'r' : 'l'}`, cx + ex, ly / 2, cz + s * (w / 2 - 0.1));
    }
  }
  return g;
}

/* ---------- optical sorter (runs along X; rotY 0 = feed west, PI = feed east) ---------- */
function opticalSorter(name, cx, cz, y, len = 5.0, w = 2.2, rotY = 0) {
  const g = new T.Group(); g.name = name; root.add(g);
  g.position.set(cx, y, cz);
  g.rotation.y = rotY;
  box(len, 0.10, w, M.belt, `${name}_accel_belt`, 0, 0, 0, g);
  box(len, 0.34, w + 0.14, M.steel, `${name}_frame`, 0, -0.26, 0, g);
  for (const s of [-1, 1]) box(len, 0.36, 0.1, M.orange, `${name}_skirt_${s > 0 ? 'a' : 'b'}`, 0, 0.22, s * (w / 2 + 0.06), g);
  box(1.9, 0.95, w + 0.5, M.orange, `${name}_sensor_hood`, -len * 0.05, 1.35, 0, g);
  box(1.5, 0.18, w + 0.2, M.steel, `${name}_lamp_bar`, -len * 0.05, 0.82, 0, g);
  for (const s of [-1, 1]) box(0.16, 1.4, 0.16, M.steel, `${name}_hood_post_${s > 0 ? 'a' : 'b'}`, -len * 0.05, 0.7, s * (w / 2 + 0.28), g);
  const mn = cyl(0.16, w + 0.3, M.steel, `${name}_air_manifold`, len / 2 - 0.15, 0.25, 0, 16, g); mn.rotation.x = Math.PI / 2;
  const sp = box(1.1, 0.1, w, M.steel, `${name}_splitter`, len / 2 + 0.75, 0.35, 0, g); sp.rotation.z = -0.5;
  box(1.3, 1.8, w + 0.2, M.machine, `${name}_eject_chute`, len / 2 + 1.1, -0.75, 0, g);
  box(1.0, 2.0, 0.8, M.machine, `${name}_control_cabinet`, -len / 2 + 0.6, -0.05, w / 2 + 1.0, g);
  cyl(0.45, 1.5, M.steel, `${name}_air_receiver`, -len / 2 + 0.6, -0.3, w / 2 + 2.0, 18, g);
  for (const ex of [-len / 2 + 0.4, len / 2 - 0.4]) for (const s of [-1, 1]) {
    box(0.18, y - 0.45, 0.18, M.steel, `${name}_leg_${ex > 0 ? 'b' : 'a'}_${s > 0 ? 'r' : 'l'}`,
      cx + Math.cos(rotY) * ex - Math.sin(rotY) * s * (w / 2), (y - 0.45) / 2,
      cz - Math.sin(rotY) * ex - Math.cos(rotY) * s * (w / 2));
  }
  return g;
}

/* =====================================================================
   LAYOUT — orthogonal grid.
   Process lanes run along X at fixed Z; transfers run along Z at fixed X.
     lane N  z = -9.0   infeed → presort → OCC screen → OCC QC → OCC bunker
     lane M  z = -1.0   DRS line
     lane S  z = +4.5   polishing screen line
     lane P  z = +9.5   NRT SpydIR → ECS
     lane R  z = +13.0  NRT w/ VIS → residue take-away → baler
     lane F  z = +2.6   ferrous (belt magnet) line
   ===================================================================== */
building();

/* 1. Tipping floor + infeed */
box(0.35, 2.6, 10, M.concrete, 'tipping_push_wall_n', -22.0, 1.3, -9.5);
box(12, 2.6, 0.35, M.concrete, 'tipping_push_wall_s', -25.0, 1.3, -4.5);
mesh(new T.BoxGeometry(11.5, 0.06, 10), M.yellow, 'tipping_floor_marking', -24.7, 0.02, -9.5).castShadow = false;

/* 2. Metering bin */
(() => {
  const g = new T.Group(); g.name = 'metering_bin'; root.add(g);
  const hopper = new T.Mesh(new T.CylinderGeometry(3.2, 2.0, 2.6, 4), M.machine);
  hopper.name = 'metering_bin_hopper'; hopper.rotation.y = Math.PI / 4;
  hopper.position.set(-18.5, 3.9, -9.0); hopper.scale.set(1.35, 1, 1.0);
  hopper.castShadow = hopper.receiveShadow = true; g.add(hopper);
  box(8.6, 1.4, 4.6, M.machine, 'metering_bin_body', -18.5, 1.9, -9.0, g);
  for (const s of [-1, 1]) box(8.6, 0.3, 0.16, M.yellow, `metering_bin_rail_${s > 0 ? 'a' : 'b'}`, -18.5, 2.72, -9.0 + s * 2.4, g);
  for (const x of [-22.3, -14.7]) for (const s of [-1, 1])
    box(0.22, 1.2, 0.22, M.steel, `metering_bin_leg_${x}_${s}`, x, 0.6, -9.0 + s * 1.9, g);
  const drum = cyl(0.55, 4.4, M.steel, 'metering_bin_drum', -14.3, 2.4, -9.0, 20, g); drum.rotation.x = Math.PI / 2;
})();

/* 3. Infeed incline (lane N) */
conveyor('conv_infeed_incline', { x: -14.0, y: 2.3, z: -9.0 }, { x: -7.5, y: 6.2, z: -9.0 }, 1.5);

/* 4. Presort platform + presort belt (lane N) */
platform('presort_platform', -7.0, -12.4, 1.0, -6.4, 5.2, 'e');
conveyor('conv_presort', { x: -7.2, y: 6.3, z: -9.0 }, { x: 1.8, y: 6.3, z: -9.0 }, 1.5);
[['residue', -5.6], ['MRP', -3.4], ['large_metal', -1.2], ['wood', 1.0]].forEach(([n, x]) => {
  const c = box(1.0, 3.4, 1.0, M.steel, `chute_${n}`, x, 4.4, -11.4);
  c.rotation.x = -0.32;
});
bunker('bunker_residue_presort', -5.6, -13.3, 3.4, 3.4, 's');
bunker('bunker_MRP', -1.6, -13.3, 3.4, 3.4, 's');
bunker('bunker_large_metal', 2.4, -13.3, 3.4, 3.4, 's');
bunker('bunker_wood', 6.4, -13.3, 3.4, 3.4, 's');

/* 5. OCC screen (lane N) */
discScreen('OCC_screen', 5.4, -9.0, 5.4, 7.0, 2.6, 7, 1);

/* OCC overs → QC platform → OCC bunker (all lane N / orthogonal transfers) */
conveyor('conv_OCC_overs', { x: 9.2, y: 5.9, z: -9.0 }, { x: 18.0, y: 5.9, z: -9.0 }, 1.4);
platform('OCC_QC_platform', 17.5, -12.6, 25.5, -6.2, 5.0, 'e');
conveyor('conv_OCC_QC', { x: 18.2, y: 6.0, z: -9.0 }, { x: 25.4, y: 6.0, z: -9.0 }, 1.4);
conveyor('conv_OCC_transfer', { x: 25.6, y: 5.9, z: -9.0 }, { x: 27.9, y: 5.4, z: -9.0 }, 1.4);
conveyor('conv_OCC_to_bunker', { x: 27.9, y: 5.4, z: -8.6 }, { x: 27.9, y: 4.3, z: -5.4 }, 1.4);
bunker('bunker_OCC', 27.3, -2.0, 5.6, 6.0, 'n', 3.4);
const qcChute = box(1.0, 3.2, 1.0, M.steel, 'chute_QC_residue', 21.5, 4.2, -12.0); qcChute.rotation.x = -0.3;
bunker('bunker_residue_QC', 21.5, -13.3, 3.4, 3.4, 's');

/* 6. OCC unders → DRS (Z transfer at x = 5, then short X run) */
conveyor('conv_OCC_unders_transfer', { x: 5.0, y: 4.3, z: -7.4 }, { x: 5.0, y: 5.4, z: -1.0 }, 1.4);
conveyor('conv_DRS_feed', { x: 5.0, y: 5.4, z: -1.0 }, { x: 7.6, y: 5.4, z: -1.0 }, 1.4);

/* 7. DRS disc screen (lane M) */
discScreen('DRS_screen', 12.0, -1.0, 4.4, 8.0, 3.0, 6, -1);

/* 7a. 2–8" fraction → polishing screen (Z transfer at x = 9.5, then lane S) */
conveyor('conv_DRS_2to8_transfer', { x: 9.5, y: 3.3, z: -2.9 }, { x: 9.5, y: 3.3, z: 4.5 }, 1.3);
conveyor('conv_DRS_2to8', { x: 9.5, y: 3.3, z: 4.5 }, { x: -8.4, y: 4.0, z: 4.5 }, 1.3);

/* 7b. 8–12" fraction → NRT SpydIR (lane M east, Z transfer at x = 19.3, lane P) */
conveyor('conv_DRS_overs', { x: 16.3, y: 3.6, z: -1.0 }, { x: 19.3, y: 3.6, z: -1.0 }, 1.3);
conveyor('conv_overs_transfer', { x: 19.3, y: 3.6, z: -1.0 }, { x: 19.3, y: 4.9, z: 9.5 }, 1.3);
conveyor('conv_SpydIR_feed', { x: 19.3, y: 4.9, z: 9.5 }, { x: 14.4, y: 4.9, z: 9.5 }, 1.3);

/* 7c. 2" unders → belt magnet (lower lane M, Z transfer at x = 22.5, lane F) */
conveyor('conv_DRS_unders', { x: 16.3, y: 2.2, z: -1.0 }, { x: 22.5, y: 2.2, z: -1.0 }, 1.2);
conveyor('conv_unders_transfer', { x: 22.5, y: 2.2, z: -1.0 }, { x: 22.5, y: 3.3, z: 2.6 }, 1.2);

/* 8. Polishing screen (lane S, west bay) */
discScreen('polishing_screen', -12.0, 4.5, 3.6, 7.0, 2.6, 6, -1);
conveyor('conv_polish_out', { x: -15.7, y: 3.1, z: 4.5 }, { x: -21.5, y: 2.8, z: 4.5 }, 1.2);
bunker('bunker_polish_product', -25.5, 4.5, 5.0, 6.0, 'e', 3.0);

/* 9. Belt magnet + drum magnet (lane F → Z transfer at x = 25.5) */
conveyor('conv_belt_magnet', { x: 22.5, y: 3.3, z: 2.6 }, { x: 28.0, y: 3.3, z: 2.6 }, 1.2);
(() => {
  const g = new T.Group(); g.name = 'belt_magnet'; root.add(g);
  box(2.6, 1.0, 1.9, M.machine, 'belt_magnet_housing', 25.2, 4.9, 2.6, g);
  const p1 = cyl(0.3, 1.9, M.steel, 'belt_magnet_pulley_a', 24.1, 4.9, 2.6, 18, g); p1.rotation.x = Math.PI / 2;
  const p2 = cyl(0.3, 1.9, M.steel, 'belt_magnet_pulley_b', 26.3, 4.9, 2.6, 18, g); p2.rotation.x = Math.PI / 2;
  box(2.2, 0.08, 1.7, M.belt, 'belt_magnet_belt', 25.2, 4.55, 2.6, g);
  for (const s of [-1, 1]) {
    box(0.14, 3.6, 0.14, M.steel, `belt_magnet_hanger_${s > 0 ? 'a' : 'b'}`, 25.2, 6.8, 2.6 + s * 1.3, g);
    box(0.14, 0.14, 3.2, M.steel, `belt_magnet_header_${s > 0 ? 'a' : 'b'}`, 25.2, 8.6, 2.6 + s * 1.3, g);
  }
})();
conveyor('conv_ferrous_out', { x: 25.2, y: 4.0, z: 4.2 }, { x: 25.2, y: 3.4, z: 8.6 }, 0.9);
(() => {
  const g = new T.Group(); g.name = 'drum_magnet'; root.add(g);
  box(2.4, 1.6, 2.2, M.machine, 'drum_magnet_housing', 25.2, 2.9, 10.3, g);
  const d = cyl(0.85, 1.9, M.steel, 'drum_magnet_drum', 25.2, 2.9, 10.3, 28, g); d.rotation.x = Math.PI / 2;
  box(1.0, 0.9, 0.7, M.machine, 'drum_magnet_drive', 23.8, 2.9, 10.3, g);
  for (const s of [-1, 1]) for (const t of [-1, 1])
    box(0.18, 2.0, 0.18, M.steel, `drum_magnet_leg_${s}_${t}`, 25.2 + s * 1.0, 1.0, 10.3 + t * 0.9, g);
})();
bunker('bunker_ferrous', 25.2, 13.3, 4.0, 3.4, 'n', 2.8);

/* 10. NRT SpydIR (lane P, feed east) → ECS west on the same lane */
opticalSorter('NRT_SpydIR', 11.0, 9.5, 4.2, 6.0, 2.4, Math.PI);
conveyor('conv_SpydIR_default', { x: 7.4, y: 3.9, z: 9.5 }, { x: 5.4, y: 3.8, z: 9.5 }, 1.2);
(() => {
  const g = new T.Group(); g.name = 'ECS'; root.add(g);
  box(4.6, 0.1, 1.6, M.belt, 'ECS_belt', 2.6, 3.7, 9.5, g);
  box(4.6, 0.4, 1.8, M.machine, 'ECS_frame', 2.6, 3.42, 9.5, g);
  const rotor = cyl(0.42, 1.6, M.orange, 'ECS_rotor', 0.5, 3.65, 9.5, 26, g); rotor.rotation.x = Math.PI / 2;
  box(1.4, 1.4, 1.8, M.steel, 'ECS_splitter_box', -0.9, 3.9, 9.5, g);
  box(1.0, 1.6, 0.8, M.machine, 'ECS_drive', 4.6, 4.6, 10.6, g);
  for (const s of [-1, 1]) for (const t of [-1, 1])
    box(0.18, 3.2, 0.18, M.steel, `ECS_leg_${s}_${t}`, 2.6 + s * 2.0, 1.6, 9.5 + t * 0.8, g);
})();
bunker('bunker_nonferrous', -4.5, 9.5, 4.0, 4.0, 'e', 2.8);

/* 11. SpydIR ejects → NRT w/ VIS (Z transfer at x = 8.6, lane R) */
conveyor('conv_ejects_transfer', { x: 8.6, y: 2.9, z: 10.6 }, { x: 8.6, y: 2.9, z: 13.0 }, 1.1);
conveyor('conv_VIS_feed', { x: 8.6, y: 2.9, z: 13.0 }, { x: 7.8, y: 2.9, z: 13.0 }, 1.1);
opticalSorter('NRT_VIS', 5.0, 13.0, 2.6, 5.2, 2.2, Math.PI);

/* 12. Residue take-away → baler (lane R) */
conveyor('conv_residue_takeaway', { x: 2.0, y: 2.5, z: 13.0 }, { x: -20.0, y: 3.0, z: 13.0 }, 1.2);
(() => {
  const g = new T.Group(); g.name = 'baler'; root.add(g);
  box(9.0, 2.4, 3.0, M.machine, 'baler_body', -26.0, 1.2, 12.5, g);
  box(3.2, 2.0, 3.4, M.steel, 'baler_hopper', -21.8, 3.4, 12.5, g);
  box(2.6, 1.6, 3.4, M.machine, 'baler_power_unit', -29.5, 3.0, 12.5, g);
  for (let i = 0; i < 3; i++) box(1.1, 1.2, 1.4, M.yellow, `bale_${i}`, -26.0 + i * 1.3, 0.6, 8.6, g);
})();

/* ---------- equipment labels (canvas sprites, view-only) ---------- */
const labels = new T.Group(); labels.name = 'labels'; root.add(labels);
const LBL_ACCENT = { machine: '#3fbf95', sorter: '#ff7a3d', out: '#ffc53d' };

function label(text, x, y, z, kind = 'machine', entity = null, scale = 1) {
  const DPR = 3, fs = 30, pad = 20, dot = 9, gap = 12;
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  const font = `600 ${fs}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.font = font;
  const tw = ctx.measureText(text.toUpperCase()).width;
  const W = Math.ceil(pad + dot + gap + tw + pad), H = fs + pad * 1.5;
  c.width = W * DPR; c.height = H * DPR;
  ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  const r = H / 2;
  // pill
  ctx.beginPath(); ctx.roundRect(0.75, 0.75, W - 1.5, H - 1.5, r);
  ctx.fillStyle = 'rgba(22,24,26,0.88)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
  // accent dot with halo
  const ax = pad + dot / 2, ay = H / 2, col = LBL_ACCENT[kind] || LBL_ACCENT.machine;
  ctx.beginPath(); ctx.arc(ax, ay, dot, 0, Math.PI * 2);
  ctx.fillStyle = col + '33'; ctx.fill();
  ctx.beginPath(); ctx.arc(ax, ay, dot / 2, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  // text
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f4f2ee';
  ctx.letterSpacing = '1.5px';
  ctx.fillText(text.toUpperCase(), pad + dot + gap, H / 2 + 1);

  const tex = new T.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, name: `label_mat_${text}` }));
  sp.name = `label_${text.replace(/[^A-Za-z0-9]+/g, '_')}`;
  const h = 0.95 * scale;
  sp.scale.set(h * (W / H), h, 1);
  sp.position.set(x, y, z);
  sp.renderOrder = 999;
  sp.userData.entity = entity;
  labels.add(sp);

  // leader: thin line down to a ring marker on the equipment
  const lineMat = new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.75, depthTest: false, name: `label_leader_mat_${text}` });
  const drop = 1.35 * scale;
  const geo = new T.BufferGeometry().setFromPoints([
    new T.Vector3(x, y - h / 2 - 0.05, z), new T.Vector3(x, y - h / 2 - drop, z)]);
  const line = new T.Line(geo, lineMat);
  line.name = `${sp.name}_leader`; line.renderOrder = 998;
  line.userData.entity = entity;
  labels.add(line);
  const ring = new T.Mesh(new T.RingGeometry(0.16 * scale, 0.24 * scale, 24),
    new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: T.DoubleSide, depthTest: false, name: `label_ring_mat_${text}` }));
  ring.name = `${sp.name}_marker`;
  ring.position.set(x, y - h / 2 - drop, z);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 998;
  ring.userData.entity = entity;
  labels.add(ring);
  return sp;
}

label('Infeed', -24.7, 4.8, -9.0, 'machine', 'tipping');
label('Metering Bin', -18.5, 7.6, -9.0, 'machine', 'metering_bin');
label('Presort', -3.0, 9.4, -9.0, 'machine', 'presort');
label('Residue', -5.6, 5.0, -13.3, 'out', 'bunker_residue_presort', 0.85);
label('MRP', -1.6, 5.0, -13.3, 'out', 'bunker_MRP', 0.85);
label('Large Metal', 2.4, 5.0, -13.3, 'out', 'bunker_large_metal', 0.85);
label('Wood', 6.4, 5.0, -13.3, 'out', 'bunker_wood', 0.85);
label('OCC Screen', 5.4, 7.8, -9.0, 'machine', 'OCC_screen');
label('OCC QC', 21.5, 9.4, -9.0, 'machine', 'OCC_QC');
label('OCC', 27.3, 5.8, -2.0, 'out', 'bunker_OCC', 0.85);
label('Residue', 21.5, 5.0, -13.3, 'out', 'bunker_residue_QC', 0.85);
label('DRS', 12.0, 7.2, -1.0, 'machine', 'DRS_screen');
label('Polishing Screen', -12.0, 6.6, 4.5, 'machine', 'polishing_screen');
label('Belt Magnet', 25.2, 7.8, 2.6, 'machine', 'belt_magnet');
label('Drum Magnet', 25.2, 5.8, 10.3, 'machine', 'drum_magnet');
label('Ferrous', 25.2, 4.6, 13.3, 'out', 'bunker_ferrous', 0.85);
label('NRT SpydIR\u00ae', 11.0, 7.4, 9.5, 'sorter', 'NRT_SpydIR');
label('ECS', 2.6, 6.4, 9.5, 'sorter', 'ECS');
label('Non-Ferrous', -4.5, 4.6, 9.5, 'out', 'bunker_nonferrous', 0.85);
label('NRT w/ VIS', 5.0, 5.8, 13.0, 'sorter', 'NRT_VIS');
label('Baler', -26.0, 5.6, 12.5, 'machine', 'baler');
label('Polished Product', -25.5, 5.0, 4.5, 'out', 'bunker_polish_product', 0.85);

/* ---------- click-to-focus interaction ---------- */
const ENTITIES = [
  { id: 'tipping',        label: 'Tipping Floor',    p: ['tipping_'] },
  { id: 'metering_bin',   label: 'Metering Bin',     p: ['metering_bin', 'conv_infeed_incline'] },
  { id: 'presort',        label: 'Presort',          p: ['presort_platform', 'conv_presort', 'chute_residue', 'chute_MRP', 'chute_large_metal', 'chute_wood'] },
  { id: 'bunker_residue_presort', label: 'Residue Bunker', p: ['bunker_residue_presort'] },
  { id: 'bunker_MRP',     label: 'MRP Bunker',       p: ['bunker_MRP'] },
  { id: 'bunker_large_metal', label: 'Large Metal Bunker', p: ['bunker_large_metal'] },
  { id: 'bunker_wood',    label: 'Wood Bunker',      p: ['bunker_wood'] },
  { id: 'OCC_screen',     label: 'OCC Screen',       p: ['OCC_screen', 'conv_OCC_unders_transfer', 'conv_DRS_feed'] },
  { id: 'OCC_QC',         label: 'OCC QC',           p: ['OCC_QC_platform', 'conv_OCC_QC', 'conv_OCC_overs', 'conv_OCC_transfer', 'conv_OCC_to_bunker', 'chute_QC_residue'] },
  { id: 'bunker_OCC',     label: 'OCC Bunker',       p: ['bunker_OCC'] },
  { id: 'bunker_residue_QC', label: 'Residue Bunker', p: ['bunker_residue_QC'] },
  { id: 'DRS_screen',     label: 'DRS Disc Screen',  p: ['DRS_screen', 'conv_DRS_2to8', 'conv_DRS_overs', 'conv_overs_transfer', 'conv_DRS_unders', 'conv_unders_transfer'] },
  { id: 'polishing_screen', label: 'Polishing Screen', p: ['polishing_screen', 'conv_polish_out'] },
  { id: 'bunker_polish_product', label: 'Polished Product', p: ['bunker_polish_product'] },
  { id: 'belt_magnet',    label: 'Belt Magnet',      p: ['belt_magnet', 'conv_belt_magnet'] },
  { id: 'drum_magnet',    label: 'Drum Magnet',      p: ['drum_magnet', 'conv_ferrous_out'] },
  { id: 'bunker_ferrous', label: 'Ferrous Bunker',   p: ['bunker_ferrous'] },
  { id: 'NRT_SpydIR',     label: 'NRT SpydIR\u00ae',  p: ['NRT_SpydIR', 'conv_SpydIR_feed', 'conv_SpydIR_default'] },
  { id: 'NRT_VIS',        label: 'NRT w/ VIS',       p: ['NRT_VIS', 'conv_ejects_transfer', 'conv_VIS_feed'] },
  { id: 'ECS',            label: 'ECS',              p: ['ECS'] },
  { id: 'bunker_nonferrous', label: 'Non-Ferrous Bunker', p: ['bunker_nonferrous'] },
  { id: 'baler',          label: 'Baler',            p: ['baler', 'bale_', 'conv_residue_takeaway'] },
];
function entityOf(obj) {
  const names = [];
  for (let o = obj; o && o !== root; o = o.parent) names.push(o.name || '');
  for (const e of ENTITIES) for (const pre of e.p) if (names.some(n => n.startsWith(pre))) return e;
  return null;
}

const meshEntity = new Map(), entityMeshes = new Map();
root.traverse(o => {
  if (!o.isMesh) return;
  for (let p = o; p; p = p.parent) if (p === labels) return;
  const e = entityOf(o);
  meshEntity.set(o, e ? e.id : null);
  o.userData.mat0 = o.material;
  if (e) {
    if (!entityMeshes.has(e.id)) entityMeshes.set(e.id, []);
    entityMeshes.get(e.id).push(o);
  }
});

const fadedCache = new Map(), hiCache = new Map();
function faded(m) {
  if (!fadedCache.has(m)) {
    const f = m.clone(); f.name = m.name + '_faded';
    f.transparent = true; f.opacity = 0.14; f.depthWrite = false;
    fadedCache.set(m, f);
  }
  return fadedCache.get(m);
}
function highlighted(m) {
  if (!hiCache.has(m)) {
    const h = m.clone(); h.name = m.name + '_selected';
    h.emissive = new T.Color(m.color).multiplyScalar(0.55); h.emissiveIntensity = 0.35;
    hiCache.set(m, h);
  }
  return hiCache.get(m);
}

const labelParts = labels.children;
let selected = null;
function select(id) {
  selected = id;
  root.traverse(o => {
    if (!o.isMesh || !o.userData.mat0) return;
    const e = meshEntity.get(o);
    if (!id) o.material = o.userData.mat0;
    else if (e === id) o.material = highlighted(o.userData.mat0);
    else o.material = faded(o.userData.mat0);
  });
  for (const o of labelParts) {
    if (!o.material) continue;
    const on = !id || o.userData.entity === id;
    o.material.transparent = true;
    o.material.opacity = on ? (o.isSprite ? 1 : 0.8) : 0.06;
  }
  const ev = new CustomEvent('mrf-select', { detail: { id, label: (ENTITIES.find(e => e.id === id) || {}).label || null } });
  window.dispatchEvent(ev);
}

window.addEventListener('mrf-clear', () => select(null));

const ray = new T.Raycaster();
const ptr = new T.Vector2();
const dom = stage._renderer.domElement;
let down = null;
dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
dom.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
  const r = dom.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, stage._camera);
  const hits = ray.intersectObject(root, true).filter(h => h.object.isMesh && meshEntity.has(h.object));
  const hit = hits.find(h => meshEntity.get(h.object));
  const id = hit ? meshEntity.get(hit.object) : null;
  select(id === selected ? null : id);
});

/* center on origin, base at y=0 */
const bb = new T.Box3().setFromObject(root);
const c = bb.getCenter(new T.Vector3());
root.position.set(-c.x, -bb.min.y, -c.z);

stage.setObject(root);
