"""Consolidate the supplied Mixamo FBXs and robot textures. Run with Blender --background --factory-startup --python."""
import bpy
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/models/player'
scratch = ROOT / 'outputs/player-build-temp'
scratch.mkdir(parents=True, exist_ok=True)
tempfile.tempdir = str(scratch)
FILES = {p.stem: p for p in sorted((DEST / 'animations').glob('*.fbx'))}
NAMES = {'Rifle Jump': 'jump', 'fire_gun': 'fire'}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.fbx(filepath=str(FILES.pop('idle_rifle')))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
base_bones = {b.name: b.matrix_local.copy() for b in rig.data.bones}
actions = [('idle_rifle', rig.animation_data.action)]
rig.animation_data_clear()
for name, path in FILES.items():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path))
    imported = set(bpy.data.objects) - before
    other = next(o for o in imported if o.type == 'ARMATURE')
    assert set(base_bones) == set(other.data.bones.keys()), path.name
    error = max(abs(base_bones[b.name][i][j] - b.matrix_local[i][j]) for b in other.data.bones for i in range(4) for j in range(4))
    assert error < 0.001, f'Incompatible bind pose: {path.name}, {error}'
    action = other.animation_data.action
    action.use_fake_user = True
    actions.append((NAMES.get(name, name), action))
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)

rig.name = 'PlayerRig'
mesh.name = 'PlayerRobot'
rig.animation_data_create()
report = []
for name, action in actions:
    action.name = name
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    start, end = action.frame_range
    strip = track.strips.new(name, 0, action)
    strip.action_frame_start = start
    strip.action_frame_end = end
    track.mute = True
    report.append({'clip': name, 'frames': int(end - start + 1), 'seconds': round((end - start) / 30, 3)})

material = bpy.data.materials.new('Robot_PBR')
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
shader = nodes.get('Principled BSDF')
prefix = 'futuristic_robot_3d_model_'
for name, ext, socket in [('basecolor', '.jpg', 'Base Color'), ('metallic', '.png', 'Metallic'), ('roughness', '.png', 'Roughness'), ('normal', '.png', 'Normal')]:
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(DEST / 'source' / (prefix + name + ext)))
    if name != 'basecolor':
        tex.image.colorspace_settings.name = 'Non-Color'
    # 1K maps keep the WebGL character inexpensive while retaining supplied originals.
    if max(tex.image.size) > 1024:
        tex.image.scale(1024, 1024)
    tex.image.pack()
    if name == 'normal':
        normal = nodes.new('ShaderNodeNormalMap')
        links.new(tex.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], shader.inputs[socket])
    else:
        links.new(tex.outputs['Color'], shader.inputs[socket])
mesh.data.materials.clear()
mesh.data.materials.append(material)
assert len(mesh.data.uv_layers), 'Missing UVs'
rig.data.pose_position = 'POSE'
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
print('BIND', json.dumps({'rigRotation': list(rig.rotation_euler), 'rigScale': list(rig.scale),
    'head': list(rig.matrix_world @ rig.data.bones['mixamorig:Head'].head_local),
    'foot': list(rig.matrix_world @ rig.data.bones['mixamorig:LeftFoot'].head_local),
    'vertices': len(mesh.data.vertices)}))
bpy.ops.export_scene.gltf(filepath=str(DEST / 'player.glb'), export_format='GLB',
    export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
    export_anim_slide_to_zero=True, export_anim_single_armature=True)
(DEST / 'animation-manifest.json').write_text(json.dumps({'fps': 30, 'clips': report}, indent=2), encoding='utf-8')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(DEST / 'source' / 'player_animated.blend'))
print('PLAYER_EXPORT', json.dumps(report))
