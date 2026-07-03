import * as THREE from 'three';
import { W, D, WATER } from './world.js';

const GRAVITY = 24, WALK = 5.2, SPRINT = 8.2, JUMP = 8.6;
const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62;

export class Player {
  constructor(game, spawn) {
    this.game = game;
    this.pos = spawn.clone();
    this.spawn = spawn.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;      // face north (-z) after spawn adjustment in main
    this.pitch = 0;
    this.onGround = false;
    this.keys = {};

    this.maxHp = 100; this.hp = 100;
    this.dmg = 8;
    this.gold = 15; this.wood = 0; this.meat = 0;
    this.xp = 0; this.level = 1;
    this.attackCd = 0;
    this.swingT = 0;
    this.dead = false;
    this.weapons = ['sword', 'bow'];   // dagger/hammer/crossbow are found in the world
    this.weaponIdx = 0;
    this.hasValyrian = false;
    this.mount = null;                 // null | 'horse' | 'dragon'
    this.bandages = 1;                 // heals 30 (Q)
    this.kits = 0;                     // full heal (F)
  }

  weapon() { return this.weapons[this.weaponIdx]; }

  eyeH() {
    if (this.mount === 'horse') return 1.62 + 0.9;
    if (this.mount === 'dragon') return 1.62 + 1.4;
    return 1.62;
  }

  xpToNext() { return this.level * 90; }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.maxHp += 15;
      this.dmg += 2;
      this.hp = this.maxHp;
      this.game.ui.toast(`Level ${this.level}! Health and damage increased.`, 'gold');
    }
  }

  damage(n) {
    if (this.dead) return;
    this.hp -= n;
    this.game.ui.flashVignette();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }

  die() {
    this.dead = true;
    this.gold = Math.floor(this.gold * 0.8);
    this.game.onPlayerDeath();
  }

  respawn() {
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.dead = false;
  }

  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); }

  update(dt) {
    if (this.dead) return;
    const world = this.game.world;

    if (this.mount === 'dragon') {
      this.updateFlight(dt);
      return;
    }

    // input → horizontal velocity
    let fx = 0, fz = 0;
    if (this.keys['KeyW']) fz += 1;
    if (this.keys['KeyS']) fz -= 1;
    if (this.keys['KeyA']) fx -= 1;
    if (this.keys['KeyD']) fx += 1;
    const len = Math.hypot(fx, fz);
    let speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? SPRINT : WALK;
    if (this.mount === 'horse') speed *= 1.9;
    const inWater = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)) === WATER;
    const eff = inWater ? speed * 0.5 : speed;
    if (len > 0) {
      fx /= len; fz /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.vel.x = (fz * -sin + fx * cos) * eff;
      this.vel.z = (fz * -cos + fx * -sin) * eff;
    } else {
      this.vel.x = 0; this.vel.z = 0;
    }

    if (inWater) {
      this.vel.y = Math.max(this.vel.y - GRAVITY * 0.3 * dt, -3);
      if (this.keys['Space']) this.vel.y = 4;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.keys['Space'] && this.onGround) {
        this.vel.y = JUMP * (this.mount === 'horse' ? 1.25 : 1);
        this.onGround = false;
      }
    }

    // axis-separated movement + collision
    this.onGround = false;
    this.pos.x += this.vel.x * dt; this.collide('x');
    this.pos.z += this.vel.z * dt; this.collide('z');
    this.pos.y += this.vel.y * dt; this.collide('y');

    // world bounds
    this.pos.x = Math.max(1.5, Math.min(W - 1.5, this.pos.x));
    this.pos.z = Math.max(1.5, Math.min(D - 1.5, this.pos.z));
    if (this.pos.y < -10) { this.pos.copy(this.spawn); this.vel.set(0, 0, 0); }

    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.swingT > 0) this.swingT = Math.max(0, this.swingT - dt * 4);
  }

  // Dragonback flight: W flies where you look, S brakes, A/D strafe, Space climbs.
  updateFlight(dt) {
    const FLY = 17;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const cosP = Math.cos(this.pitch), sinP = Math.sin(this.pitch);
    const fwd = { x: -sinY * cosP, y: sinP, z: -cosY * cosP };
    let vx = 0, vy = 0, vz = 0;
    if (this.keys['KeyW']) { vx += fwd.x * FLY; vy += fwd.y * FLY; vz += fwd.z * FLY; }
    if (this.keys['KeyS']) { vx -= fwd.x * FLY * 0.5; vy -= fwd.y * FLY * 0.5; vz -= fwd.z * FLY * 0.5; }
    if (this.keys['KeyA']) { vx += -cosY * FLY * 0.6; vz += sinY * FLY * 0.6; }
    if (this.keys['KeyD']) { vx += cosY * FLY * 0.6; vz += -sinY * FLY * 0.6; }
    if (this.keys['Space']) vy += 9;
    // gentle hover sink so landing is possible by easing off
    if (!this.keys['KeyW'] && !this.keys['Space']) vy -= 2.5;
    this.vel.set(vx, vy, vz);
    this.onGround = false;
    this.pos.x += this.vel.x * dt; this.collide('x');
    this.pos.z += this.vel.z * dt; this.collide('z');
    this.pos.y += this.vel.y * dt; this.collide('y');
    this.pos.x = Math.max(1.5, Math.min(W - 1.5, this.pos.x));
    this.pos.z = Math.max(1.5, Math.min(D - 1.5, this.pos.z));
    this.pos.y = Math.min(60, this.pos.y);
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.swingT > 0) this.swingT = Math.max(0, this.swingT - dt * 4);
  }

  collide(axis) {
    const world = this.game.world;
    const minX = Math.floor(this.pos.x - HALF), maxX = Math.floor(this.pos.x + HALF);
    const minY = Math.floor(this.pos.y),        maxY = Math.floor(this.pos.y + HEIGHT);
    const minZ = Math.floor(this.pos.z - HALF), maxZ = Math.floor(this.pos.z + HALF);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (!world.isSolid(x, y, z)) continue;
          if (axis === 'y') {
            if (this.vel.y <= 0) { this.pos.y = y + 1; this.onGround = true; }
            else { this.pos.y = y - HEIGHT - 0.001; }
            this.vel.y = 0;
          } else if (axis === 'x') {
            this.pos.x = this.vel.x > 0 ? x - HALF - 0.001 : x + 1 + HALF + 0.001;
            this.vel.x = 0;
          } else {
            this.pos.z = this.vel.z > 0 ? z - HALF - 0.001 : z + 1 + HALF + 0.001;
            this.vel.z = 0;
          }
          return;
        }
      }
    }
  }
}
