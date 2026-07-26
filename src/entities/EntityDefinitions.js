import * as THREE from 'three';

// Stat tables + simple procedural "monster" meshes (no external model
// assets - everything is built from primitives, tinted per entity type)
// for each of BACKDOOR's entity types.

export const ENTITY_DEFS = {
  crawler: {
    name: 'Crawler',
    codexName: 'Crawler',
    codexDesc: '기어다니며 느리지만 절대 추적을 멈추지 않는다. 한 번 발각되면 끈질기게 따라온다.',
    behavior: 'chaser',
    color: 0x4a3a2a,
    height: 0.9,
    speedPatrol: 0.8,
    speedChase: 1.7,
    detectionRadius: 9,
    fovDeg: 100,
    hearingMultiplier: 1.3,
    contactRadius: 0.9,
    damage: 18,
    instaKill: false,
    giveUpTime: 9,
    scoreWeight: 1
  },
  watcher: {
    name: 'Watcher',
    codexName: 'Watcher',
    codexDesc: '평소에는 가만히 서 있지만, 시야에 들어오면 즉시 추적을 시작한다.',
    behavior: 'chaser',
    color: 0x2a2a3a,
    height: 1.9,
    speedPatrol: 0.4,
    speedChase: 3.4,
    detectionRadius: 12,
    fovDeg: 130,
    hearingMultiplier: 0.8,
    contactRadius: 0.9,
    damage: 22,
    instaKill: false,
    giveUpTime: 6,
    scoreWeight: 1.2
  },
  monster: {
    name: 'Backrooms Monster',
    codexName: 'Backrooms Monster',
    codexDesc: '방 안을 배회하는 정체불명의 존재. 가까이 오면 공격적으로 변한다.',
    behavior: 'chaser',
    color: 0x5a3a3a,
    height: 2.1,
    speedPatrol: 1.0,
    speedChase: 2.9,
    detectionRadius: 10,
    fovDeg: 110,
    hearingMultiplier: 1.0,
    contactRadius: 1.0,
    damage: 25,
    instaKill: false,
    giveUpTime: 7,
    scoreWeight: 1.1
  },
  fakehuman: {
    name: 'Fake Human',
    codexName: 'Fake Human',
    codexDesc: '멀리서 보면 평범한 사람처럼 보이지만, 가까이 다가가면 정체를 드러낸다.',
    behavior: 'fakehuman',
    color: 0xc9b79a,
    revealColor: 0x8a1010,
    height: 1.8,
    speedPatrol: 0.5,
    speedChase: 3.8,
    detectionRadius: 999,
    revealRadius: 5.5,
    fovDeg: 360,
    hearingMultiplier: 0.5,
    contactRadius: 1.0,
    damage: 30,
    instaKill: false,
    giveUpTime: 5,
    scoreWeight: 1.4
  },
  rush: {
    name: 'Rush',
    codexName: 'Rush',
    codexDesc: '복도를 엄청난 속도로 돌진한다. 숨지 않으면 생존을 장담할 수 없다.',
    behavior: 'rush',
    color: 0x1a1a1a,
    height: 1.6,
    speedPatrol: 0,
    speedChase: 14,
    telegraphTime: 1.6,
    detectionRadius: 999,
    fovDeg: 360,
    hearingMultiplier: 0,
    contactRadius: 1.1,
    damage: 100,
    instaKill: true,
    scoreWeight: 2
  },
  shadow: {
    name: 'Shadow',
    codexName: 'Shadow',
    codexDesc: '불이 꺼졌을 때만 모습을 드러내는 그림자. 빛이 돌아오면 사라진다.',
    behavior: 'shadow',
    color: 0x000000,
    height: 2.0,
    speedPatrol: 0.6,
    speedChase: 3.0,
    detectionRadius: 8,
    fovDeg: 150,
    hearingMultiplier: 1.1,
    contactRadius: 0.95,
    damage: 28,
    instaKill: false,
    giveUpTime: 8,
    scoreWeight: 1.5
  },
  unknown: {
    name: 'Unknown',
    codexName: '???',
    codexDesc: '극히 드물게 목격되는 정체불명의 존재. 목격 즉시 강렬한 공포를 남기고 사라진다.',
    behavior: 'scare_once',
    color: 0x8822aa,
    height: 2.4,
    speedPatrol: 0.2,
    speedChase: 0,
    detectionRadius: 7,
    fovDeg: 360,
    hearingMultiplier: 1.0,
    contactRadius: 3.2,
    damage: 15,
    instaKill: false,
    scoreWeight: 3
  }
};

export function buildEntityMesh(def) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85, metalness: 0.05 });
  const h = def.height;

  const bodyHeight = Math.max(0.2, h - 0.35);
  const radius = 0.28;
  let body;
  try {
    body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, bodyHeight - radius * 2, 4, 8), bodyMat);
  } catch (e) {
    body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bodyHeight, 8), bodyMat);
  }
  body.position.y = bodyHeight / 2 + 0.05;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bodyMat);
  head.position.y = bodyHeight + 0.2;
  head.castShadow = true;
  group.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, bodyHeight + 0.22, 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  group.add(eyeL, eyeR);

  group.userData.bodyMat = bodyMat;
  group.userData.eyeMat = eyeMat;
  group.userData.head = head;
  return group;
}
