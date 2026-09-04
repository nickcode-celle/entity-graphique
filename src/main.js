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
  minSpeed: 0.022,
  maxSpeed: 0.042,
  catchup: 0.42,
  turnRate: 1.75,
  frameX: 3.25,
  frameY: 1.95,
  trailSpacing: 1.05,
  cohesion: 0.16,
  separation: 0.055,
  separationDistance: 0.25,
  lateralFreedom: 0.28,
  depth: 0.48,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V12.1' })
gui.add(params, 'speed', 0.015, 0.05, 0.001).name('Vitesse tête')
gui.add(params, 'minSpeed', 0.012, 0.04, 0.001).name('Vitesse mini')
gui.add(params, 'maxSpeed', 0.025, 0.06, 0.001).name('Vitesse maxi')
gui.add(params, 'catchup', 0.05, 0.9, 0.01).name('Rattrapage')
gui.add(params, 'turnRate', 0.5, 3.0, 0.05).name('Fluidité virage')
gui.add(params, 'frameX', 2.4, 4.0, 0.05).name('Cadre horizontal')
gui.add(params, 'frameY', 1.4, 2.6, 0.05).name('Cadre vertical')
gui.add(params, 'trailSpacing', 0.6, 1.8, 0.05).name('Retard trajectoire')
gui.add(params, 'cohesion', 0.04, 0.35, 0.005).name('Cohésion parcours')
gui.add(params, 'separation', 0, 0.15, 0.002).name('Séparation')
gui.add(params, 'lateralFreedom', 0.08, 0.55, 0.01).name('Liberté latérale')
gui.add(params, 'depth', 0.10, 0.9, 0.02).name('Profondeur')

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

const leaderHeading = new THREE.Vector3(1, 0.06, 0).normalize()
const leaderDesired = leaderHeading.clone()

const leaderStart = new THREE.Vector3(-1.55, 0, 0)

// Pré-histoire rectiligne du parcours : dès la première image, les suiveuses
// disposent déjà d'une route cohérente derrière la tête.
for (let i = 0; i < 420; i++) {
  trail.push({
    position: leaderStart.clone().addScaledVector(leaderHeading, -i * params.speed),
    heading: leaderHeading.clone(),
  })
}

for (let i = 0; i < 100; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf1f3f5,
    roughness: 0.32,
    metalness: 0.04,
  })
  const mesh = new THREE.Mesh(geometry, material)

  const rank = i === 0 ? 0 : 10 + Math.floor((i - 1) / 5) * params.trailSpacing
  const sampleIndex = THREE.MathUtils.clamp(Math.floor(rank), 0, trail.length - 1)
  const sample = trail[sampleIndex]
  const lane = i === 0 ? 0 : ((i - 1) % 5) - 2
  const side = new THREE.Vector3(-sample.heading.y, sample.heading.x, 0).normalize()

  mesh.position.copy(sample.position)
  mesh.position.addScaledVector(side, lane * 0.20 + (Math.random() - 0.5) * 0.07)
  mesh.position.z = (Math.random() - 0.5) * params.depth * 0.7

  marbles.push({
    mesh,
    heading: sample.heading.clone(),
    phase: Math.random() * Math.PI * 2,
    trailOffset: rank,
    speed: params.speed,
    laneBias: lane * 0.18 + (Math.random() - 0.5) * 0.05,
  })
  scene.add(mesh)
}

const leader = marbles[0]
leader.mesh.position.copy(leaderStart)
leader.trailOffset = 0

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const target = new THREE.Vector3()
const side = new THREE.Vector3()
const sep = new THREE.Vector3()
const inward = new THREE.Vector3()

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
  const nearRight = p.x > params.frameX * 0.62
  const nearLeft = p.x < -params.frameX * 0.62
  const nearTop = p.y > params.frameY * 0.60
  const nearBottom = p.y < -params.frameY * 0.60

  if (nearRight || nearLeft || nearTop || nearBottom) {
    inward.set(-p.x, -p.y, 0)
    if (inward.lengthSq() > 0.0001) {
      inward.normalize()
      leaderDesired.lerp(inward, 0.34).normalize()
    }
    return
  }

  const t = performance.now() * 0.001
  const gentle = Math.sin(t * 0.52) * 0.008 + Math.sin(t * 0.21 + 1.7) * 0.004
  leaderDesired.copy(rotatePlanar(leaderDesired, gentle))
}

function pushTrail() {
  trail.unshift({
    position: leader.mesh.position.clone(),
    heading: leader.heading.clone(),
  })
  if (trail.length > 700) trail.pop()
}

function trailSample(offset) {
  const idx = THREE.MathUtils.clamp(Math.floor(offset), 0, trail.length - 1)
  return trail[idx]
}

function updateLeader(dt) {
  chooseLeaderDirection()
  const turn = 1 - Math.exp(-params.turnRate * dt)
  leader.heading.lerp(leaderDesired, turn).normalize()

  const velocity = tmp.copy(leader.heading).multiplyScalar(params.speed)
  leader.mesh.position.addScaledVector(velocity, dt * 60)

  // Deuxième niveau de sécurité : bien avant le bord visuel, la direction est
  // déjà tournée vers l'intérieur. Le clamp n'est qu'un filet numérique ultime.
  leader.mesh.position.x = THREE.MathUtils.clamp(leader.mesh.position.x, -params.frameX, params.frameX)
  leader.mesh.position.y = THREE.MathUtils.clamp(leader.mesh.position.y, -params.frameY, params.frameY)

  pushTrail()
}

function updateFollower(i, dt, elapsed) {
  const m = marbles[i]
  const sample = trailSample(m.trailOffset)

  side.set(-sample.heading.y, sample.heading.x, 0).normalize()

  // Liberté locale faible et cohérente : elle donne de l'épaisseur sans permettre
  // à la bille d'abandonner son couloir autour du parcours commun.
  const breathing = Math.sin(m.phase + elapsed * 0.48) * params.lateralFreedom * 0.28
  target.copy(sample.position)
  target.addScaledVector(side, m.laneBias + breathing)
  target.z += Math.sin(m.phase * 1.71 + elapsed * 0.31) * params.depth * 0.22

  const toTarget = tmp.copy(target).sub(m.mesh.position)
  const distance = toTarget.length()
  if (distance > 0.0001) toTarget.normalize()

  const desired = tmp2.copy(sample.heading)
  const correction = THREE.MathUtils.clamp(distance * params.cohesion, 0, 0.72)
  desired.lerp(toTarget, correction).normalize()

  sep.set(0, 0, 0)
  for (let j = 0; j < marbles.length; j++) {
    if (j === i) continue
    const other = marbles[j]
    const d = m.mesh.position.distanceTo(other.mesh.position)
    if (d > 0.0001 && d < params.separationDistance) {
      sep.add(
        tmp.copy(m.mesh.position)
          .sub(other.mesh.position)
          .normalize()
          .multiplyScalar(1 - d / params.separationDistance)
      )
    }
  }
  if (sep.lengthSq() > 0.0001) {
    sep.normalize().multiplyScalar(params.separation)
    desired.add(sep).normalize()
  }

  // Jamais de marche arrière : la correction de trajectoire ne peut pas inverser le vol.
  if (desired.dot(m.heading) < 0.20) desired.lerp(m.heading, 0.82).normalize()

  const turn = 1 - Math.exp(-params.turnRate * dt)
  m.heading.lerp(desired, turn).normalize()

  // La différence essentielle avec V12 : une bille en retard accélère légèrement,
  // une bille proche de sa cible ralentit, mais la vitesse reste TOUJOURS positive.
  const forwardError = target.clone().sub(m.mesh.position).dot(sample.heading)
  const wantedSpeed = THREE.MathUtils.clamp(
    params.speed + forwardError * params.catchup * 0.018,
    params.minSpeed,
    params.maxSpeed
  )
  m.speed = THREE.MathUtils.lerp(m.speed, wantedSpeed, 1 - Math.exp(-4.0 * dt))

  const velocity = tmp.copy(m.heading).multiplyScalar(m.speed)
  m.mesh.position.addScaledVector(velocity, dt * 60)

  // Si une bille approche réellement du cadre, on n'attend pas qu'elle sorte :
  // on réduit progressivement sa liberté latérale en la ramenant vers son parcours.
  if (Math.abs(m.mesh.position.x) > params.frameX * 0.92 || Math.abs(m.mesh.position.y) > params.frameY * 0.92) {
    m.mesh.position.lerp(target, 0.035)
  }
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
