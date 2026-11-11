import bpy,math,json,tempfile
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent;(out/'temp').mkdir(exist_ok=True);tempfile.tempdir=str(out/'temp')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=r'C:\Users\macab\Downloads\beacon.glb')
s=bpy.context.scene;parts=[bpy.data.objects[f'tripo_part_{i}'] for i in range(4)]
points=[o.matrix_world@Vector(p) for o in parts for p in o.bound_box];lo=Vector([min(p[k] for p in points) for k in range(3)]);hi=Vector([max(p[k] for p in points) for k in range(3)]);scale=5/(hi.z-lo.z);center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
for o in parts:
 matrix=o.matrix_world.copy();o.parent=None;o.matrix_world.identity()
 for v in o.data.vertices:v.co=(matrix@v.co-center)*scale
for o in list(s.objects):
 if o not in parts:bpy.data.objects.remove(o,do_unlink=True)
def group(name):
 o=bpy.data.objects.new(name,None);s.collection.objects.link(o);return o
root=group('launch_beacon');base=group('beacon_base');capsule=group('beacon_capsule');base.parent=root;capsule.parent=root
bottom=min(v.co.z for v in parts[1].data.vertices);capsule.location.z=bottom
parts[0].parent=base
for o in parts[1:]:
 o.parent=capsule;o.location.z=-bottom
ring=parts[3];vs=[v.co for v in ring.data.vertices];z=(min(v.z for v in vs)+max(v.z for v in vs))/2;radius=max(math.hypot(v.x,v.y) for v in vs)*.95
for i,name in enumerate(['ruby','sapphire','emerald','amethyst','dust']):
 o=group('gem_socket_'+name);o.parent=capsule;a=i*math.tau/5;o.location=(math.sin(a)*radius,-math.cos(a)*radius,z-bottom)
engine=group('engine_socket');engine.parent=capsule;engine.location=(0,0,0);engine.rotation_euler.x=math.pi
bpy.ops.export_scene.gltf(filepath=str(out/'beacon.glb'),export_format='GLB',export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'beacon.blend'))
(out/'layout.json').write_text(json.dumps({'height':5,'capsuleBase':bottom,'gemHeight':z,'gemRadius':radius,'fixed':['tripo_part_0'],'moving':['tripo_part_1','tripo_part_2','tripo_part_3']},indent=2))
