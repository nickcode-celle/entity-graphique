import GUI from 'lil-gui'

let guiRef=null
let controlsRef=null
let addedOnce=false
const originalAdd=GUI.prototype.add

GUI.prototype.add=function(object,property,...args){
  const controller=originalAdd.call(this,object,property,...args)
  if(!guiRef){guiRef=this;controlsRef=object}
  return controller
}

await import('./main-bloom-reference.js')

if(guiRef&&controlsRef&&!addedOnce){
  addedOnce=true

  const byProperty=new Map()
  for(const c of guiRef.controllersRecursive?.() ?? guiRef.controllers ?? []){
    if(c?._name) byProperty.set(c._name,c)
    if(c?.property) byProperty.set(c.property,c)
  }

  const setExisting=(property,value)=>{
    const c=(guiRef.controllersRecursive?.() ?? guiRef.controllers ?? []).find(x=>x?.property===property)
    if(c)c.setValue(value)
    else controlsRef[property]=value
  }

  setExisting('RELATION_GLOBALE',8)
  setExisting('ROTATION',.11)
  setExisting('FREQUENCE_INVERSIONS',12)
  setExisting('BRILLANCE',.62)
  setExisting('CAMERA',350)

  const props=new Set((guiRef.controllersRecursive?.() ?? guiRef.controllers ?? []).map(c=>c?.property))
  if(!props.has('INTENSITE_LUMIERE')) guiRef.add(controlsRef,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE')
  if(!props.has('LUMIERE_AMBIANTE')) guiRef.add(controlsRef,'LUMIERE_AMBIANTE',0,4,.05).name('LUMIÈRE AMBIANTE')
  if(!props.has('ECART')) guiRef.add(controlsRef,'ECART',18,42,.5).name('TAILLE / ÉCART')
  if(!props.has('TAILLE_BILLES')) guiRef.add(controlsRef,'TAILLE_BILLES',.4,1.5,.01).name('TAILLE BILLES')
  if(!props.has('V1')) guiRef.add(controlsRef,'V1',.2,2,.01).name('V1 — VIE INTERNE')
  if(!props.has('LIBERTE')) guiRef.add(controlsRef,'LIBERTE',0,.5,.01).name('LIBERTÉ CELLULE')
  if(!props.has('CHEVAUCHEMENT')) guiRef.add(controlsRef,'CHEVAUCHEMENT',1,2,.01).name('CHEVAUCHEMENT')
  if(!props.has('VOIR_CELLULES')) guiRef.add(controlsRef,'VOIR_CELLULES').name('VOIR CELLULES')
}

GUI.prototype.add=originalAdd
