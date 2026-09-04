import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import './style.css'

// ENTITY — OPEN-SOURCE FLOCKING BASELINE
// Dynamics copied from the official Three.js r180 webgl_gpgpu_birds example (MIT).
// Only two intentional presentation changes:
//   1) WIDTH = 10 -> exactly 100 agents.
//   2) agents are rendered as white spheres instead of bird triangles.
// The flocking equations/weights below are otherwise the reference example.

const WIDTH = 10
const BIRDS = WIDTH * WIDTH
const BOUNDS = 800
const BOUNDS_HALF = BOUNDS / 2

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000)
camera.position.z = 350

let mouseX = 10000
let mouseY = 10000
let windowHalfX = window.innerWidth / 2
let windowHalfY = window.innerHeight / 2
let last = performance.now()

const positionShader = /* glsl */`
uniform float time;
uniform float delta;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 tmpPos = texture2D( texturePosition, uv );
  vec3 position = tmpPos.xyz;
  vec3 velocity = texture2D( textureVelocity, uv ).xyz;

  float phase = tmpPos.w;
  phase = mod( ( phase + delta +
    length( velocity.xz ) * delta * 3. +
    max( velocity.y, 0.0 ) * delta * 6. ), 62.83 );

  gl_FragColor = vec4( position + velocity * delta * 15., phase );
}
`

const velocityShader = /* glsl */`
uniform float time;
uniform float testing;
uniform float delta;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float freedomFactor;
uniform vec3 predator;

const float width = resolution.x;
const float height = resolution.y;
const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;

float zoneRadius = 40.0;
float zoneRadiusSquared = 1600.0;
float separationThresh = 0.45;
float alignmentThresh = 0.65;

const float UPPER_BOUNDS = BOUNDS;
const float LOWER_BOUNDS = -UPPER_BOUNDS;
const float SPEED_LIMIT = 9.0;

float rand( vec2 co ) {
  return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
}

void main() {
  zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
  separationThresh = separationDistance / zoneRadius;
  alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
  zoneRadiusSquared = zoneRadius * zoneRadius;

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 birdPosition, birdVelocity;

  vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
  vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

  float dist;
  vec3 dir;
  float distSquared;
  float separationSquared = separationDistance * separationDistance;
  float cohesionSquared = cohesionDistance * cohesionDistance;
  float f;
  float percent;
  vec3 velocity = selfVelocity;
  float limit = SPEED_LIMIT;

  dir = predator * UPPER_BOUNDS - selfPosition;
  dir.z = 0.;
  dist = length( dir );
  distSquared = dist * dist;

  float preyRadius = 150.0;
  float preyRadiusSq = preyRadius * preyRadius;

  if ( dist < preyRadius ) {
    f = ( distSquared / preyRadiusSq - 1.0 ) * delta * 100.;
    velocity += normalize( dir ) * f;
    limit += 5.0;
  }

  vec3 central = vec3( 0., 0., 0. );
  dir = selfPosition - central;
  dist = length( dir );
  dir.y *= 2.5;
  velocity -= normalize( dir ) * delta * 5.;

  for ( float y = 0.0; y < height; y++ ) {
    for ( float x = 0.0; x < width; x++ ) {
      vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
      birdPosition = texture2D( texturePosition, ref ).xyz;

      dir = birdPosition - selfPosition;
      dist = length( dir );
      if ( dist < 0.0001 ) continue;

      distSquared = dist * dist;
      if ( distSquared > zoneRadiusSquared ) continue;

      percent = distSquared / zoneRadiusSquared;

      if ( percent < separationThresh ) {
        f = ( separationThresh / percent - 1.0 ) * delta;
        velocity -= normalize( dir ) * f;
      } else if ( percent < alignmentThresh ) {
        float threshDelta = alignmentThresh - separationThresh;
        float adjustedPercent = ( percent - separationThresh ) / threshDelta;
        birdVelocity = texture2D( textureVelocity, ref ).xyz;
        f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * delta;
        velocity += normalize( birdVelocity ) * f;
      } else {
        float threshDelta = 1.0 - alignmentThresh;
        float adjustedPercent;
        if ( threshDelta == 0. ) adjustedPercent = 1.;
        else adjustedPercent = ( percent - alignmentThresh ) / threshDelta;
        f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * delta;
        velocity += normalize( dir ) * f;
      }
    }
  }

  if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
  }

  gl_FragColor = vec4( velocity, 1.0 );
}
`

const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer)
const dtPosition = gpuCompute.createTexture()
const dtVelocity = gpuCompute.createTexture()

function fillPositionTexture(texture) {
  const data = texture.image.data
  for (let k = 0; k < data.length; k += 4) {
    data[k] = Math.random() * BOUNDS - BOUNDS_HALF
    data[k + 1] = Math.random() * BOUNDS - BOUNDS_HALF
    data[k + 2] = Math.random() * BOUNDS - BOUNDS_HALF
    data[k + 3] = 1
  }
}

function fillVelocityTexture(texture) {
  const data = texture.image.data
  for (let k = 0; k < data.length; k += 4) {
    data[k] = (Math.random() - 0.5) * 10
    data[k + 1] = (Math.random() - 0.5) * 10
    data[k + 2] = (Math.random() - 0.5) * 10
    data[k + 3] = 1
  }
}

fillPositionTexture(dtPosition)
fillVelocityTexture(dtVelocity)

const velocityVariable = gpuCompute.addVariable('textureVelocity', velocityShader, dtVelocity)
const positionVariable = gpuCompute.addVariable('texturePosition', positionShader, dtPosition)

gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable])
gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable])

const positionUniforms = positionVariable.material.uniforms
const velocityUniforms = velocityVariable.material.uniforms

positionUniforms.time = { value: 0.0 }
positionUniforms.delta = { value: 0.0 }
velocityUniforms.time = { value: 1.0 }
velocityUniforms.delta = { value: 0.0 }
velocityUniforms.testing = { value: 1.0 }
velocityUniforms.separationDistance = { value: 20.0 }
velocityUniforms.alignmentDistance = { value: 20.0 }
velocityUniforms.cohesionDistance = { value: 20.0 }
velocityUniforms.freedomFactor = { value: 0.75 }
velocityUniforms.predator = { value: new THREE.Vector3() }
velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2)

velocityVariable.wrapS = THREE.RepeatWrapping
velocityVariable.wrapT = THREE.RepeatWrapping
positionVariable.wrapS = THREE.RepeatWrapping
positionVariable.wrapT = THREE.RepeatWrapping

const computeError = gpuCompute.init()
if (computeError !== null) throw new Error(computeError)

// Sphere renderer only. It reads the position texture produced by the untouched flocking model.
const sphereBase = new THREE.SphereGeometry(3.2, 16, 12)
const sphereGeometry = new THREE.InstancedBufferGeometry()
sphereGeometry.index = sphereBase.index
sphereGeometry.setAttribute('position', sphereBase.getAttribute('position'))
sphereGeometry.setAttribute('normal', sphereBase.getAttribute('normal'))
sphereGeometry.setAttribute('uv', sphereBase.getAttribute('uv'))
sphereGeometry.instanceCount = BIRDS

const references = new Float32Array(BIRDS * 2)
for (let i = 0; i < BIRDS; i++) {
  references[i * 2] = (i % WIDTH + 0.5) / WIDTH
  references[i * 2 + 1] = (Math.floor(i / WIDTH) + 0.5) / WIDTH
}
sphereGeometry.setAttribute('reference', new THREE.InstancedBufferAttribute(references, 2))

const sphereUniforms = {
  texturePosition: { value: null },
}

const sphereMaterial = new THREE.ShaderMaterial({
  uniforms: sphereUniforms,
  vertexShader: /* glsl */`
    attribute vec2 reference;
    uniform sampler2D texturePosition;
    varying vec3 vNormal;
    varying float vDepth;

    void main() {
      vec3 center = texture2D(texturePosition, reference).xyz;
      vec3 world = center + position;
      vNormal = normalize(normalMatrix * normal);
      vDepth = world.z;
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vNormal;
    varying float vDepth;

    void main() {
      vec3 lightDir = normalize(vec3(0.4, 0.7, 0.6));
      float diffuse = 0.42 + max(dot(vNormal, lightDir), 0.0) * 0.58;
      float depthCue = clamp((vDepth + 400.0) / 800.0, 0.0, 1.0);
      float value = diffuse * mix(0.68, 1.0, depthCue);
      gl_FragColor = vec4(vec3(value), 1.0);
    }
  `,
})

const spheres = new THREE.Mesh(sphereGeometry, sphereMaterial)
scene.add(spheres)

// Small source label; no simulation controls are exposed so the reference model stays fixed.
const label = document.createElement('div')
label.textContent = '100 billes — Three.js GPGPU flocking reference (MIT)'
Object.assign(label.style, {
  position: 'fixed',
  left: '14px',
  bottom: '12px',
  color: 'rgba(255,255,255,.55)',
  font: '12px Arial, sans-serif',
  pointerEvents: 'none',
})
document.body.appendChild(label)

function onPointerMove(event) {
  if (event.isPrimary === false) return
  mouseX = event.clientX - windowHalfX
  mouseY = event.clientY - windowHalfY
}
renderer.domElement.addEventListener('pointermove', onPointerMove)

function onResize() {
  windowHalfX = window.innerWidth / 2
  windowHalfY = window.innerHeight / 2
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

function animate() {
  requestAnimationFrame(animate)

  const now = performance.now()
  let delta = (now - last) / 1000
  if (delta > 1) delta = 1
  last = now

  positionUniforms.time.value = now
  positionUniforms.delta.value = delta
  velocityUniforms.time.value = now
  velocityUniforms.delta.value = delta

  velocityUniforms.predator.value.set(
    0.5 * mouseX / windowHalfX,
    -0.5 * mouseY / windowHalfY,
    0,
  )

  mouseX = 10000
  mouseY = 10000

  gpuCompute.compute()
  sphereUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture

  renderer.render(scene, camera)
}

animate()
