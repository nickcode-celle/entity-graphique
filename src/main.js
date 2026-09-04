import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

const params = {
  speed: 0.030,
  turnRate: 1.6,
  frameX: 3.6,
  frameY: 2.25,
  trailSpacing: 0.055,
  cohesion: 0.055,
  separation: 0.10,
  separationDistance: 0.28,
  lateralFreedom: 0.42,
  depth: 0.52,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V12' })
gui.add(params, 'speed', 0.015, 0.06, 0.001).name('Vitesse constante')
gui.add(params, 'turnRate', 0.4, 3.0, 0.05).name('Fluidité virage')
gui.add(params, 'frameX', 2.4, 4.5, 0.05).name('Cadre horizontal')
gui.add(params, 'frameY', 1.5, 3.0, 0.05).name('Cadre vertical')
gui.add(params, 'trailSpacing', 0.025, 0.10, 0.002).name('Retard trajectoire')
gui.add(params, 'cohesion', 0.01, 0.12, 0.002).name('Cohésion au parcours')
gui.add(params, 'separation', 0, 0.20, 0.002).name('Séparation')
gui.add(params, 'lateralFreedom', 0.1, 0.8, 0.02).name('Liberté latérale')
gui.add(params, 'depth', 0.10, 1.2, 0.02).name('Profondeur')

scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x20242a, 1.15))
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6)
keyLight.position.set(4.5, 5.5, 7)
scene.add(keyLight)
const rimLight = new THREE.DirectionalLight(0xbfd6ff, 2.2)
rimLight.position.set(-6, 2, -3)
scene.add(rimLight)
const lowLight = new THREE.DirectionalLight(0xffffff, 0.65)
lowLight.position.set(1, -5, 4)
scene.add(lowLight)

const geometry = new THREE.SphereGeometry(0.105, 20, 20)
const marbles = []
const clock = new THREE.Clock()
const trail = []

const leaderHeading = new THREE.Vector3(1, 0.08, 0).normalize()
const leaderDesired = leaderHeading.clone()

for (let i = 0; i < 100; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf1f3f5,
    roughness: 0.32,
    metalness: 0.04,
  })
  const mesh = new THREE.Mesh(geometry, material)

  const column = i % 20
  const row = Math.floor(i / 20)
  const x = -2.1 + column * 0.20 + (Math.random() - 0.5) * 0.09
  const y = (row - 2) * 0.34 + (Math.random() - 0.5) * 0.16
  const z = (Math.random() - 0.5) * params.depth
  mesh.position.set(x, y, z)

  marbles.push({
    mesh,
    heading: leaderHeading.clone(),
    phase: Math.random() * Math.PI * 2,
    trailOffset: 12 + i * 1.45,
  })
  scene.add(mesh)
}

const leader = marbles[0]
leader.trailOffset = 0
leader.mesh.position.set(-1.5, 0, 0)

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const target = new THREE.Vector3()
const side = new THREE.Vector3()
const sep = new THREE.Vector3()

function rotatePlanar(v, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new THREE.Vector3(
    v.x * c - v.y * s,
    v.x * s + v.y * c,
    v.z
  ).normalize()
}

function chooseLeaderDirection() {
  const p = leader.mesh.position

  // Le leader commence à préparer son virage bien avant le bord.
  const nearRight = p.x > params.frameX * 0.72
  const nearLeft = p.x < -params.frameX * 0.72
  const nearTop = p.y > params.frameY * 0.70
  const nearBottom = p.y < -params.frameY * 0.70

  if (nearRight || nearLeft || nearTop || nearBottom) {
    const inward = new THREE.Vector3(-p.x, -p.y, 0).normalize()
    leaderDesired.lerp(inward, 0.22).normalize()
    return
  }

  // Hors des bords : courbure lente, jamais de changement brutal.
  const t = performance.now() * 0.001
  const gentle = Math.sin(t * 0.58) * 0.010 + Math.sin(t * 0.23 + 1.7) * 0.006
  leaderDesired.copy(rotatePlanar(leaderDesired, gentle))
}

function pushTrail() {
  trail.unshift({
    position: leader.mesh.position.clone(),
    heading: leader.heading.clone(),
  })
  if (trail.length > 650) trail.pop()
}

function trailSample(offset) {
  if (!trail.length) return null
  const idx = THREE.MathUtils.clamp(Math.floor(offset), 0, trail.length - 1)
  return trail[idx]
}

function updateLeader(dt) {
  chooseLeaderDirection()
  const turn = 1 - Math.exp(-params.turnRate * dt)
  leader.heading.lerp(leaderDesired, turn).normalize()

  const velocity = tmp.copy(leader.heading).multiplyScalar(params.speed)
  leader.mesh.position.addScaledVector(velocity, dt * 60)

  // Sécurité dure uniquement pour empêcher toute sortie numérique.
  leader.mesh.position.x = THREE.MathUtils.clamp(leader.mesh.position.x, -params.frameX, params.frameX)
  leader.mesh.position.y = THREE.MathUtils.clamp(leader.mesh.position.y, -params.frameY, params.frameY)

  pushTrail()
}

function updateFollower(i, dt, elapsed) {
  const m = marbles[i]
  const sample = trailSample(m.trailOffset)
  if (!sample) return

  // La bille suit la même route que celles qui la précèdent : le virage est donc
  // rencontré au même endroit du parcours, mais plus tard.
  side.set(-sample.heading.y, sample.heading.x, 0).normalize()
  const lateral = Math.sin(m.phase + elapsed * 0.55) * params.lateralFreedom
  const vertical = Math.sin(m.phase * 1.73 + elapsed * 0.37) * params.depth * 0.32

  target.copy(sample.position)
  target.addScaledVector(side, lateral)
  target.z += vertical

  const toTarget = tmp.copy(target).sub(m.mesh.position)
  const distance = toTarget.length()
  if (distance > 0.0001) toTarget.normalize()

  // Cohésion au parcours, sans marche arrière.
  const desired = tmp2.copy(sample.heading)
  desired.lerp(toTarget, THREE.MathUtils.clamp(distance * params.cohesion, 0, 0.42)).normalize()

  // Séparation locale uniquement, assez faible pour ne jamais casser le groupe.
  sep.set(0, 0, 0)
  for (let j = 0; j < marbles.length; j++) {
    if (j === i) continue
    const other = marbles[j]
    const d = m.mesh.position.distanceTo(other.mesh.position)
    if (d > 0.0001 && d < params.separationDistance) {
      sep.add(tmp.copy(m.mesh.position).sub(other.mesh.position).normalize().multiplyScalar(1 - d / params.separationDistance))
    }
  }
  if (sep.lengthSq() > 0.0001) {
    sep.normalize().multiplyScalar(params.separation)
    desired.add(sep).normalize()
  }

  // Jamais immobile et jamais en marche arrière.
  if (desired.dot(m.heading) < 0.18) desired.lerp(m.heading, 0.78).normalize()

  const turn = 1 - Math.exp(-params.turnRate * dt)
  m.heading.lerp(desired, turn).normalize()

  const velocity = tmp.copy(m.heading).multiplyScalar(params.speed)
  m.mesh.position.addScaledVector(velocity, dt * 60)
}

function updateDepthCue(m) {
  const zNorm = THREE.MathUtils.clamp((m.mesh.position.z / Math.max(params.depth, 0.01) + 1) * 0.5, 0, 1)
  const scale = THREE.MathUtils.lerp(0.86, 1.16, zNorm)
  m.mesh.scale.setScalar(scale)
  const lightness = THREE.MathUtils.lerp(0.55, 0.96, zNorm)
  m.mesh.material.color.setHSL(0.60, 0.05, lightness)
}

function updateSwarm(dt, elapsed) {
  updateLeader(dt)

  for (let i = 1; i < marbles.length; i++) {
    updateFollower(i, dt, elapsed)
  }

  for (const m of marbles) updateDepthCue(m)
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 1 / 30)
  updateSwarm(dt, clock.elapsedTime)
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
