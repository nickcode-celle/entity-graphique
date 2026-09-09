from pathlib import Path

p=Path('src/main-entity-50.js')
s=p.read_text()

if "import {createNewMarbleBirth} from './new-marble-birth.js'" not in s:
    anchor="import './style.css'"
    if anchor not in s:
        raise SystemExit('style import anchor not found')
    s=s.replace(anchor,anchor+"\nimport {createNewMarbleBirth} from './new-marble-birth.js'",1)

if 'const newMarbleBirth=createNewMarbleBirth(THREE,scene,bloomLayer)' not in s:
    anchor='const bloomLayer=1'
    if anchor not in s:
        raise SystemExit('bloomLayer anchor not found')
    s=s.replace(anchor,anchor+"\nconst newMarbleBirth=createNewMarbleBirth(THREE,scene,bloomLayer)",1)

if 'newMarbleBirth.update(performance.now()/1000)' not in s:
    anchor='function animate(){requestAnimationFrame(animate);'
    if anchor not in s:
        raise SystemExit('animate anchor not found')
    s=s.replace(anchor,anchor+'newMarbleBirth.update(performance.now()/1000);',1)

p.write_text(s)
