import bpy, math, os
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

# Dense but clean master shell.
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

# IMPORTANT: keep every cutter as a separate closed solid in a Blender collection.
# A Boolean modifier can subtract a COLLECTION directly. This avoids joining many
# overlapping cutters into one non-manifold mesh, which corrupted the previous test.
cutters_collection=bpy.data.collections.new('Gastronomie_CavityCutters')
bpy.context.scene.collection.children.link(cutters_collection)

count=76
golden=math.pi*(3-math.sqrt(5))
for i in range(count):
    y=1-2*(i+0.5)/count
    rr=math.sqrt(max(0,1-y*y))
    theta=i*golden + 0.16*math.sin(i*1.73)
    d=Vector((math.cos(theta)*rr,y,math.sin(theta)*rr)).normalized()

    # Controlled variation: mostly medium holes, a few slightly larger/smaller.
    s=0.145 + 0.050*(0.5+0.5*math.sin(i*2.417+0.8))
    if i % 13 == 0: s*=1.22
    if i % 9 == 0: s*=0.82
    oval=0.88 + 0.20*(0.5+0.5*math.sin(i*0.91))
    depth=0.78 + 0.08*(0.5+0.5*math.sin(i*1.11))

    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1.0, location=d*(R-0.11))
    c=bpy.context.object
    c.name=f'Cavity_{i:03d}'
    c.scale=(s, s*oval, depth)
    c.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Move cutter out of the render scene hierarchy into the dedicated Boolean collection.
    for col in list(c.users_collection):
        col.objects.unlink(c)
    cutters_collection.objects.link(c)

mod=shell.modifiers.new('Cavities','BOOLEAN')
mod.operation='DIFFERENCE'
mod.solver='EXACT'
mod.operand_type='COLLECTION'
mod.collection=cutters_collection
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)

# Remove cutters completely after the Boolean result is baked.
for c in list(cutters_collection.objects):
    bpy.data.objects.remove(c, do_unlink=True)
bpy.data.collections.remove(cutters_collection)

# Round the actual Boolean-generated cavity rims in the shell itself.
bev=shell.modifiers.new('RoundedCavityLips','BEVEL')
bev.width=0.050
bev.segments=4
bev.limit_method='ANGLE'
bev.angle_limit=math.radians(28)
bev.harden_normals=False
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=bev.name)
for p in shell.data.polygons:
    p.use_smooth=True

red=mat_principled('Gastronomie_Red',(0.80,0.010,0.006),0.16,0.0)
shell.data.materials.append(red)

# Dark core, recessed enough that each opening reads as a deep cavity.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.49, location=(0,0,0))
core=bpy.context.object
core.name='Gastronomie_DarkCore'
black=mat_principled('Interior',(0.002,0.002,0.002),0.95,0.0)
core.data.materials.append(black)

# Preview-only studio.
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,-2.15))
floor=bpy.context.object
floor.data.materials.append(mat_principled('Floor',(0.01,0.01,0.012),0.32,0.0))

bpy.ops.object.camera_add(location=(0.0,-7.2,0.25))
cam=bpy.context.object
look_at(cam,(0,0,0))
bpy.context.scene.camera=cam
cam.data.lens=58

bpy.ops.object.light_add(type='AREA', location=(3.2,-4.1,4.5))
key=bpy.context.object
key.data.energy=1150
key.data.shape='DISK'; key.data.size=3.0
look_at(key,(0,0,0))

bpy.ops.object.light_add(type='AREA', location=(-3.8,-1.5,1.8))
fill=bpy.context.object
fill.data.energy=300
fill.data.size=2.4
look_at(fill,(0,0,0))

bpy.ops.object.light_add(type='AREA', location=(-2.4,2.8,-0.4))
rim=bpy.context.object
rim.data.energy=720
rim.data.color=(1.0,0.025,0.01)
rim.data.size=2.2
look_at(rim,(0,0,0))

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1024
scene.render.resolution_y=1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.003,0.004,0.006)

repo=os.environ.get('GITHUB_WORKSPACE', os.getcwd())
os.makedirs(os.path.join(repo,'public','models'),exist_ok=True)
os.makedirs(os.path.join(repo,'artifacts'),exist_ok=True)

# Render preview first, so visual verification is always produced before export.
scene.render.filepath=os.path.join(repo,'artifacts','gastronomie_preview.png')
bpy.ops.render.render(write_still=True)

# Export only the two runtime objects.
bpy.ops.object.select_all(action='DESELECT')
shell.select_set(True); core.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.export_scene.gltf(filepath=os.path.join(repo,'public','models','gastronomie.glb'), export_format='GLB', use_selection=True, export_apply=True)

print('Generated public/models/gastronomie.glb and artifacts/gastronomie_preview.png')
