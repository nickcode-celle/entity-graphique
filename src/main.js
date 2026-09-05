import * as THREE from 'three'
import GUI from 'lil-gui'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import './style.css'

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x101215)
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(0, 0, 25)
const root = new THREE.Group(); scene.add(root)

const controls = { ROTATION: 0.14, BRILLANCE: 0.62, INTENSITE_LUMIERE: 4.2, LUMIERE_AMBIANTE: 0.85, CAMERA: 25 }

function makePorousShell() {
  const evaluator = new Evaluator(); evaluator.useGroups = false
  let result = new Brush(new THREE.SphereGeometry(6, 96, 64)); result.updateMatrixWorld(true)
  const inner = new Brush(new THREE.SphereGeometry(4.78, 80, 56)); inner.updateMatrixWorld(true)
  result = evaluator.evaluate(result, inner, SUBTRACTION)

  const count = 42, golden = Math.PI * (3 - Math.sqrt(5))
  let seed = 0x51a7e
  const rnd = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 }

  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) * 2) / count
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * golden + (rnd() - 0.5) * 0.45
    const dir = new THREE.Vector3(Math.cos(theta) * rr, y, Math.sin(theta) * rr).normalize()
    const radius = THREE.MathUtils.lerp(0.48, 1.0, Math.pow(rnd(), 0.72))
    const centerRadius = 5.72 + THREE.MathUtils.lerp(-0.16, 0.14, rnd())
    const cutter = new Brush(new THREE.SphereGeometry(radius, 24, 18))
    cutter.position.copy(dir).multiplyScalar(centerRadius); cutter.updateMatrixWorld(true)
    result = evaluator.evaluate(result, cutter, SUBTRACTION)
  }

  result.geometry.computeVertexNormals(); result.geometry.computeBoundingSphere()
  return result.geometry
}

const porousGeometry = makePorousShell()
const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe5231f, roughness: 0.24, metalness: 0.02, clearcoat: 0.72, clearcoatRoughness: 0.18 })
const innerMaterial = new THREE.MeshStandardMaterial({ color: 0x090708, roughness: 0.9, metalness: 0 })
const shell = new THREE.Mesh(porousGeometry, shellMaterial); shell.castShadow = shell.receiveShadow = true; root.add(shell)
const core = new THREE.Mesh(new THREE.SphereGeometry(4.56, 64, 48), innerMaterial); core.castShadow = core.receiveShadow = true; root.add(core)

const hemi = new THREE.HemisphereLight(0xffffff, 0x20242a, controls.LUMIERE_AMBIANTE); scene.add(hemi)
const key = new THREE.SpotLight(0xffffff, controls.INTENSITE_LUMIERE, 0, Math.PI / 3.6, 0.42, 0)
key.position.set(10, 10, 18); key.target.position.set(0, 0, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.00015; key.shadow.normalBias = 0.012; scene.add(key, key.target)
const rim = new THREE.PointLight(0xff3322, 1.2, 80); rim.position.set(-10, -4, -3); scene.add(rim)

function updateShine() { shellMaterial.roughness = THREE.MathUtils.lerp(0.7, 0.08, controls.BRILLANCE); shellMaterial.clearcoat = THREE.MathUtils.lerp(0.2, 0.9, controls.BRILLANCE) }
updateShine()
const gui = new GUI({ title: 'ENTITY — GASTRONOMIE / VRAIE 3D' })
gui.add(controls, 'ROTATION', 0, 1, 0.01).name('ROTATION')
gui.add(controls, 'BRILLANCE', 0, 1, 0.01).name('BRILLANCE').onChange(updateShine)
gui.add(controls, 'INTENSITE_LUMIERE', 0, 8, 0.05).name('INTENSITÉ LUMIÈRE').onChange(v => { key.intensity = v })
gui.add(controls, 'LUMIERE_AMBIANTE', 0, 2.5, 0.05).name('LUMIÈRE AMBIANTE').onChange(v => { hemi.intensity = v })
gui.add(controls, 'CAMERA', 10, 50, 0.5).name('CAMERA').onChange(v => { camera.position.z = v })

const tag = document.createElement('div'); tag.textContent = 'GASTRONOMIE / SAVEURS — géométrie CSG réelle'; Object.assign(tag.style, { position:'fixed', left:'16px', bottom:'14px', color:'rgba(255,255,255,.72)', font:'12px Arial', letterSpacing:'.08em' }); document.body.appendChild(tag)

const clock = new THREE.Clock()
function animate() { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), 0.04); root.rotation.y += controls.ROTATION * dt; root.rotation.x += controls.ROTATION * 0.17 * dt; renderer.render(scene, camera) }
animate()

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) })
