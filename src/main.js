import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const app = document.querySelector('#app')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050505)

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  100
)
camera.position.set(0, 0, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

const params = {
  cohesion: 0.0045,
  separation: 0.055,
  alignment: 0.035,
  maxSpeed: 0.028,
  neighbourRadius: 1.5,
  comfortDistance: 0.48,
  breathing: 0.08,
  breathingSpeed: 0.55,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V1' })
gui.add(params, 'cohesion', 0, 0.02, 0.0001).name('Cohésion')
gui.add(params, 'separation', 0, 0.15, 0.001).name('Séparation')
gui.add(params, 'alignment', 0, 0.12, 0.001).name('Alignement')
gui.add(params, 'maxSpeed', 0.005, 0.08, 0.001).name('Vitesse')
gui.add(params, 'neighbourRadius', 0.5, 3, 0.05).name('Rayon voisins')
gui.add(params, 'comfortDistance', 0.2, 1, 0.01).name('Distance confort')
gui.add(params, 'breathing', 0, 0.25, 0.005).name('Respiration')
gui.add(params, 'breathingSpeed', 0.1, 1.5, 0.05).name('Rythme respiration')

const swarm = new THREE.Group()
scene.add(swarm)

const geometry = new THREE.SphereGeometry(0.105, 18, 18)
const material = new THREE.MeshStandardMaterial({
  color: 0xf2f2f2,
  roughness: 0.38,
  metalness: 0.06,
})

scene.add(new THREE.AmbientLight(0xffffff, 0.85))

const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
keyLight.position.set(5, 6, 8)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xffffff, 0.7)
fillLight.position.set(-5, -2, 4)
scene.add(fillLight)

const marbles = []

for (let i = 0; i < 100; i++) {
  const mesh = new THREE.Mesh(geometry, material)

  // Nuage organique compact, volontairement non géométrique.
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const radius = Math.pow(Math.random(), 0.65) * 3.1

  mesh.position.set(
    Math.sin(phi) * Math.cos(theta) * radius * 1.15,
    Math.cos(phi) * radius * 0.8,
    Math.sin(phi) * Math.sin(theta) * radius * 0.85
  )

  const velocity = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  )
    .normalize()
    .multiplyScalar(params.maxSpeed * (0.65 + Math.random() * 0.35))

  swarm.add(mesh)
  marbles.push({ mesh, velocity })
}

const center = new THREE.Vector3()
const cohesionForce = new THREE.Vector3()
const separationForce = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const delta = new THREE.Vector3()
const tmp = new THREE.Vector3()
const clock = new THREE.Clock()

function limitSpeed(vector, max) {
  const lengthSq = vector.lengthSq()
  if (lengthSq > max * max) vector.setLength(max)
}

function updateSwarm(dt, elapsed) {
  center.set(0, 0, 0)
  for (const marble of marbles) center.add(marble.mesh.position)
  center.divideScalar(marbles.length)

  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i]

    cohesionForce
      .copy(center)
      .sub(marble.mesh.position)
      .multiplyScalar(params.cohesion)

    separationForce.set(0, 0, 0)
    alignmentForce.set(0, 0, 0)
    let neighbours = 0

    for (let j = 0; j < marbles.length; j++) {
      if (i === j) continue

      const other = marbles[j]
      delta.copy(marble.mesh.position).sub(other.mesh.position)
      const distanceSq = delta.lengthSq()

      if (distanceSq < params.neighbourRadius * params.neighbourRadius) {
        alignmentForce.add(other.velocity)
        neighbours++
      }

      if (
        distanceSq > 0 &&
        distanceSq < params.comfortDistance * params.comfortDistance
      ) {
        const distance = Math.sqrt(distanceSq)
        separationForce.add(
          tmp
            .copy(delta)
            .normalize()
            .multiplyScalar((params.comfortDistance - distance) / params.comfortDistance)
        )
      }
    }

    if (neighbours > 0) {
      alignmentForce
        .divideScalar(neighbours)
        .sub(marble.velocity)
        .multiplyScalar(params.alignment)
    }

    separationForce.multiplyScalar(params.separation)

    marble.velocity
      .addScaledVector(cohesionForce, dt * 60)
      .addScaledVector(separationForce, dt * 60)
      .addScaledVector(alignmentForce, dt * 60)

    limitSpeed(marble.velocity, params.maxSpeed)
    marble.mesh.position.addScaledVector(marble.velocity, dt * 60)
  }

  // Respiration : micro-dilatation collective autour du centre, sans changer la morphologie.
  const breath = Math.sin(elapsed * params.breathingSpeed * Math.PI * 2) * params.breathing
  const breathScale = 1 + breath * 0.0009 * dt * 60

  for (const marble of marbles) {
    marble.mesh.position
      .sub(center)
      .multiplyScalar(breathScale)
      .add(center)
  }
}

function animate() {
  requestAnimationFrame(animate)

  const dt = Math.min(clock.getDelta(), 1 / 30)
  const elapsed = clock.elapsedTime

  updateSwarm(dt, elapsed)

  // Très légère rotation de présentation, uniquement pour lire le volume 3D.
  swarm.rotation.y += 0.00035 * dt * 60

  renderer.render(scene, camera)
}

animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
