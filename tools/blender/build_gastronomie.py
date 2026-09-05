import bpy, math, os
from mathutils import Vector

# Clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Helpers
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

# Target proportions based on the approved visual reference:
# near-perfect sphere, dense individual cavities, rounded lips, dark interior.
R=2.0
INNER=1.63
THICK=R-INNER

# Outer sphere
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=R, location=(0,0,0))
shell=bpy.context.object
shell.name='Gastronomie_Shell'

# Inner subtraction creates a genuine shell
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=INNER, location=(0,0,0))
inner=bpy.context.object
inner.name='InnerCut'
mod=shell.modifiers.new('Hollow','BOOLEAN')
mod.operation='DIFFERENCE'
mod.solver='EXACT'
mod.object=inner
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(inner, do_unlink=True)

# Dense deterministic Fibonacci cavity distribution.
# Hole cutters are slightly oblate and radial, giving rounded irregular openings.
count=72
golden=math.pi*(3-math.sqrt(5))
cutters=[]
for i in range(count):
    y=1-2*(i+0.5)/count
    rr=math.sqrt(max(0,1-y*y))
    theta=i*golden + 0.22*math.sin(i*1.73)
    d=Vector((math.cos(theta)*rr,y,math.sin(theta)*rr)).normalized()
    # varied but controlled opening sizes; no giant merged cavities
    s=0.135 + 0.07*(0.5+0.5*math.sin(i*2.417+0.8))
    if i % 11 == 0: s*=1.30
    if i % 7 == 0: s*=0.78
    depth=0.70 + 0.10*(0.5+0.5*math.sin(i*1.11))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0, location=d*(R-0.10))
    c=bpy.context.object
    c.name=f'Hole_{i:03d}'
    c.scale=(s*1.02, s*(0.90+0.18*(0.5+0.5*math.sin(i*0.91))), depth)
    # align local Z to radial direction
    c.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cutters.append(c)

# Join cutters into one object for a single exact boolean
bpy.ops.object.select_all(action='DESELECT')
for c in cutters: c.select_set(True)
bpy.context.view_layer.objects.active=cutters[0]
bpy.ops.object.join()
cutters_obj=bpy.context.object
cutters_obj.name='CavityCutters'

mod=shell.modifiers.new('Cavities','BOOLEAN')
mod.operation='DIFFERENCE'
mod.solver='EXACT'
mod.object=cutters_obj
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutters_obj, do_unlink=True)

# This is the key difference versus the failed WebGL CSG versions:
# bevel the boolean-generated cavity rims directly in the shell geometry.
bev=shell.modifiers.new('RoundedCavityLips','BEVEL')
bev.width=0.055
bev.segments=4
bev.limit_method='ANGLE'
bev.angle_limit=math.radians(32)
bev.harden_normals=True
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=bev.name)

# Smooth only after boolean + bevel
for p in shell.data.polygons: p.use_smooth=True

red=mat_principled('Gastronomie_Red',(0.78,0.012,0.008),0.18,0.0)
shell.data.materials.append(red)

# Dark core gives the deep black interiors visible through holes
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.54, location=(0,0,0))
core=bpy.context.object
core.name='Gastronomie_DarkCore'
black=mat_principled('Interior',(0.003,0.003,0.003),0.9,0.0)
core.data.materials.append(black)

# Floor for reference render only
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,-2.15))
floor=bpy.context.object
floor_mat=mat_principled('Floor',(0.01,0.01,0.012),0.32,0.0)
floor.data.materials.append(floor_mat)

# Camera and studio lighting close to target reference
bpy.ops.object.camera_add(location=(0.0,-7.2,0.35))
cam=bpy.context.object
look_at(cam,(0,0,0))
bpy.context.scene.camera=cam
cam.data.lens=58

# Key
bpy.ops.object.light_add(type='AREA', location=(3.2,-4.1,4.5))
key=bpy.context.object
key.data.energy=1050
key.data.shape='DISK'; key.data.size=3.0
look_at(key,(0,0,0))
# Fill
bpy.ops.object.light_add(type='AREA', location=(-3.8,-1.5,1.8))
fill=bpy.context.object
fill.data.energy=250
fill.data.size=2.4
look_at(fill,(0,0,0))
# Red rim
bpy.ops.object.light_add(type='AREA', location=(-2.4,2.8,-0.4))
rim=bpy.context.object
rim.data.energy=700
rim.data.color=(1.0,0.025,0.01)
rim.data.size=2.2
look_at(rim,(0,0,0))

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1024
scene.render.resolution_y=1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.003,0.004,0.006)

repo=os.environ.get('GITHUB_WORKSPACE', os.getcwd())
os.makedirs(os.path.join(repo,'public','models'),exist_ok=True)
os.makedirs(os.path.join(repo,'artifacts'),exist_ok=True)

# Export only model objects, not floor/camera/lights
bpy.ops.object.select_all(action='DESELECT')
shell.select_set(True); core.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.export_scene.gltf(filepath=os.path.join(repo,'public','models','gastronomie.glb'), export_format='GLB', use_selection=True, export_apply=True)

# Render verification image
scene.render.filepath=os.path.join(repo,'artifacts','gastronomie_preview.png')
bpy.ops.render.render(write_still=True)

print('Generated public/models/gastronomie.glb and artifacts/gastronomie_preview.png')
