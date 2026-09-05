import bpy, bmesh, math, os
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def look_at(obj, target=(0,0,0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z','Y').to_euler()

def mat_principled(name, color, roughness=0.22, metallic=0.0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    return m

R=2.0
INNER=1.63

# Master shell: dense enough that the outer silhouette remains a near-perfect sphere.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=R, location=(0,0,0))
shell=bpy.context.object
shell.name='Gastronomie_Shell'

# Hollow the sphere first.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=INNER, location=(0,0,0))
inner=bpy.context.object
mod=shell.modifiers.new('Hollow','BOOLEAN')
mod.operation='DIFFERENCE'
mod.solver='EXACT'
mod.object=inner
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(inner, do_unlink=True)

# Keep every cutter as a separate closed object and subtract the whole collection.
cutters_collection=bpy.data.collections.new('Gastronomie_CavityCutters')
bpy.context.scene.collection.children.link(cutters_collection)
count=82
golden=math.pi*(3-math.sqrt(5))
for i in range(count):
    y=1-2*(i+0.5)/count
    rr=math.sqrt(max(0,1-y*y))
    theta=i*golden + 0.13*math.sin(i*1.73)
    d=Vector((math.cos(theta)*rr,y,math.sin(theta)*rr)).normalized()

    # Reference-like distribution: many medium cells, a few smaller/larger, never giant.
    s=0.155 + 0.045*(0.5+0.5*math.sin(i*2.417+0.8))
    if i % 17 == 0: s*=1.18
    if i % 11 == 0: s*=0.84
    oval=0.90 + 0.16*(0.5+0.5*math.sin(i*0.91))
    depth=0.82

    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=28, radius=1.0, location=d*(R-0.12))
    c=bpy.context.object
    c.name=f'Cavity_{i:03d}'
    c.scale=(s, s*oval, depth)
    c.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for col in list(c.users_collection): col.objects.unlink(c)
    cutters_collection.objects.link(c)

mod=shell.modifiers.new('Cavities','BOOLEAN')
mod.operation='DIFFERENCE'
mod.solver='EXACT'
mod.operand_type='COLLECTION'
mod.collection=cutters_collection
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)
for c in list(cutters_collection.objects): bpy.data.objects.remove(c, do_unlink=True)
bpy.data.collections.remove(cutters_collection)

# CRITICAL: bevel ONLY the true transition edge outer-sphere -> cavity wall.
# The previous Angle modifier also beveled Boolean triangulation edges, creating star spikes.
# Here we classify each manifold edge by the normals of its two adjacent faces.
bm=bmesh.new()
bm.from_mesh(shell.data)
bm.normal_update()
rim_edges=[]
for e in bm.edges:
    if len(e.link_faces)!=2: continue
    mid=(e.verts[0].co+e.verts[1].co)*0.5
    if mid.length < 1.82: continue
    radial=mid.normalized()
    dots=[abs(f.normal.normalized().dot(radial)) for f in e.link_faces]
    # One face follows the spherical exterior; the other turns into the cavity wall.
    if max(dots)>0.72 and min(dots)<0.58:
        rim_edges.append(e)

print('Detected true cavity rim edges:', len(rim_edges))
if rim_edges:
    bmesh.ops.bevel(
        bm,
        geom=rim_edges,
        offset=0.052,
        offset_type='OFFSET',
        segments=5,
        profile=0.62,
        affect='EDGES',
        clamp_overlap=True,
        loop_slide=True,
    )
    bm.normal_update()
bm.to_mesh(shell.data)
bm.free()
shell.data.update()

for p in shell.data.polygons: p.use_smooth=True

red=mat_principled('Gastronomie_Red',(0.80,0.008,0.004),0.19,0.0)
shell.data.materials.append(red)

# Dark recessed core: darkness comes from depth, not a painted black texture.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.43, location=(0,0,0))
core=bpy.context.object
core.name='Gastronomie_DarkCore'
core.data.materials.append(mat_principled('Interior',(0.0015,0.0015,0.0015),0.98,0.0))

# Preview-only studio, intentionally close to the user's target reference.
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,-2.15))
floor=bpy.context.object
floor.data.materials.append(mat_principled('Floor',(0.008,0.008,0.010),0.34,0.0))

bpy.ops.object.camera_add(location=(0.0,-7.45,0.20))
cam=bpy.context.object
look_at(cam,(0,0,0))
bpy.context.scene.camera=cam
cam.data.lens=60

bpy.ops.object.light_add(type='AREA', location=(3.0,-4.2,4.3))
key=bpy.context.object
key.data.energy=900
key.data.shape='DISK'; key.data.size=3.4
look_at(key,(0,0,0))

bpy.ops.object.light_add(type='AREA', location=(-3.6,-1.2,2.0))
fill=bpy.context.object
fill.data.energy=180
fill.data.size=2.8
look_at(fill,(0,0,0))

bpy.ops.object.light_add(type='AREA', location=(-2.5,2.8,-0.5))
rim=bpy.context.object
rim.data.energy=760
rim.data.color=(1.0,0.018,0.006)
rim.data.size=2.0
look_at(rim,(0,0,0))

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1024
scene.render.resolution_y=1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.002,0.003,0.005)

repo=os.environ.get('GITHUB_WORKSPACE', os.getcwd())
os.makedirs(os.path.join(repo,'public','models'),exist_ok=True)
os.makedirs(os.path.join(repo,'artifacts'),exist_ok=True)

scene.render.filepath=os.path.join(repo,'artifacts','gastronomie_preview.png')
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='DESELECT')
shell.select_set(True); core.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.export_scene.gltf(filepath=os.path.join(repo,'public','models','gastronomie.glb'), export_format='GLB', use_selection=True, export_apply=True)

print('Generated public/models/gastronomie.glb and artifacts/gastronomie_preview.png')
