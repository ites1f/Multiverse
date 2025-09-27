import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

/* ===== Tunables (sliders will override) ===== */
let GRAVITY  = -0.027, JUMP_VEL = 0.14, WALK = 0.072, SPRINT = 0.093;
let GRID_RADIUS = 1;
let MASK_SCALE=0.003, HILL_SCALE=0.02, DETAIL_SCALE=0.08, MOUNT_AMP=25;

/* ===== Slider bindings ===== */
gSlider.oninput = e => GRAVITY = parseFloat(e.target.value);
jSlider.oninput = e => JUMP_VEL = parseFloat(e.target.value);
wSlider.oninput = e => WALK = parseFloat(e.target.value);
sSlider.oninput = e => SPRINT = parseFloat(e.target.value);
rSlider.oninput = e => { GRID_RADIUS = parseInt(e.target.value); regenAll(); };
maskSlider.oninput = e => { MASK_SCALE=parseFloat(e.target.value); regenAll(); };
hillSlider.oninput = e => { HILL_SCALE=parseFloat(e.target.value); regenAll(); };
detailSlider.oninput = e => { DETAIL_SCALE=parseFloat(e.target.value); regenAll(); };
mountSlider.oninput = e => { MOUNT_AMP=parseFloat(e.target.value); regenAll(); };

/* ===== Config ===== */
const CHUNK = { X:16, Y:64, Z:16 };
const BLOCK = { AIR:0, STONE:1, GRASS:2, DIRT:3, GLASS:4 };
let CURRENT_BLOCK = BLOCK.STONE;

/* ===== Scene ===== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.fog = new THREE.Fog(0x0b1220, 80, 220);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x1a2438, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(0.7,1,0.4); scene.add(dir);

const info = document.getElementById("info");

/* ===== Input ===== */
const keys = new Set(); let pointerLocked=false; let yaw=0, pitch=0;
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
document.body.addEventListener("click",()=>{if(!pointerLocked)renderer.domElement.requestPointerLock();});
document.addEventListener("pointerlockchange",()=>{pointerLocked=(document.pointerLockElement===renderer.domElement);});
document.addEventListener("mousemove",(e)=>{
  if(!pointerLocked) return;
  const sens=0.0025, MAX_D=80;
  const dx=Math.max(-MAX_D,Math.min(MAX_D,e.movementX||0));
  const dy=Math.max(-MAX_D,Math.min(MAX_D,e.movementY||0));
  yaw-=dx*sens; pitch-=dy*sens;
  pitch=Math.max(-Math.PI/2+0.001,Math.min(Math.PI/2-0.001,pitch));
});
addEventListener("keydown",e=>{
  const k=e.key.toLowerCase(); keys.add(k);
  if(k==="1")CURRENT_BLOCK=BLOCK.STONE;
  if(k==="2")CURRENT_BLOCK=BLOCK.GRASS;
  if(k==="3")CURRENT_BLOCK=BLOCK.DIRT;
  if(k==="4")CURRENT_BLOCK=BLOCK.GLASS;
  if(k==="r")regenAll();
});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
addEventListener("contextmenu",e=>e.preventDefault());

/* ===== Noise ===== */
function hash2i(x,y){ let h=x*374761393+y*668265263; h=(h^(h>>13))*1274126177; return(h>>>0)/0xffffffff; }
const smoothstep=t=>t*t*(3-2*t);
function valueNoise2(x,y){const xi=Math.floor(x),yi=Math.floor(y);const tx=x-xi,ty=y-yi;
  const a=hash2i(xi,yi),b=hash2i(xi+1,yi),c=hash2i(xi,yi+1),d=hash2i(xi+1,yi+1);
  const sx=smoothstep(tx),sy=smoothstep(ty);const u=a+(b-a)*sx,v=c+(d-c)*sx;return u+(v-u)*sy;}
function fbm2(x,y){let amp=1,freq=1,sum=0,norm=0;for(let i=0;i<4;i++){sum+=valueNoise2(x*freq,y*freq)*amp;norm+=amp;amp*=0.5;freq*=2;}return sum/norm;}

function sampleTerrain(wx,wz){
  const mask=fbm2(wx*MASK_SCALE,wz*MASK_SCALE);
  const hills=fbm2(wx*HILL_SCALE,wz*HILL_SCALE);
  const detail=fbm2(wx*DETAIL_SCALE,wz*DETAIL_SCALE);
  const mountains=(hills*detail)*(mask*2.5);
  const base=30+mask*10;
  return Math.floor(base+mountains*MOUNT_AMP);
}

/* ===== World, Physics, Meshing ===== */
// 👉 Bring in your full Chunk, buildMesh, getBlock/setBlock, regenAll, and physics (moveAndCollide + animate loop)
// They don’t change except sampleTerrain and sliders, so copy that section here.
/* ===== World ===== */
class Chunk {
  constructor(cx,cz){
    this.cx=cx; this.cz=cz;
    this.blocks=new Uint8Array(CHUNK.X*CHUNK.Y*CHUNK.Z);
    this.mesh=null; this.generated=false;
  }
}
const chunks=new Map();
const key=(cx,cz)=>`${cx},${cz}`;
const idx=(x,y,z)=>x+CHUNK.X*(z+CHUNK.Z*y);

function generateChunk(c){
  if(c.generated) return;
  const baseX=c.cx*CHUNK.X, baseZ=c.cz*CHUNK.Z;
  for(let z=0;z<CHUNK.Z;z++){
    for(let x=0;x<CHUNK.X;x++){
      const wx=baseX+x, wz=baseZ+z;
      const h=sampleTerrain(wx,wz);
      for(let y=0;y<CHUNK.Y;y++){
        let id=BLOCK.AIR;
        if(y===h) id=BLOCK.GRASS;
        else if(y<h-3) id=BLOCK.STONE;
        else if(y<h) id=BLOCK.DIRT;
        c.blocks[idx(x,y,z)]=id;
      }
    }
  }
  c.generated=true;
}

function isTransparent(id){ return id===BLOCK.AIR||id===BLOCK.GLASS; }
function blockColor(id){
  switch(id){
    case BLOCK.STONE:return new THREE.Color(0x9aa0a6);
    case BLOCK.GRASS:return new THREE.Color(0x55aa55);
    case BLOCK.DIRT:return new THREE.Color(0x7a4e2a);
    case BLOCK.GLASS:return new THREE.Color(0x77c4ff);
  } return new THREE.Color(0,0,0);
}

/* ===== Meshing ===== */
function neighborBlock(c,x,y,z,dir){
  let nx=x,ny=y,nz=z,cx=c.cx,cz=c.cz;
  if(dir===0)nx++; if(dir===1)nx--;
  if(dir===2)ny++; if(dir===3)ny--;
  if(dir===4)nz++; if(dir===5)nz--;
  if(ny<0||ny>=CHUNK.Y) return BLOCK.AIR;
  if(nx<0){cx--;nx+=CHUNK.X;}
  if(nx>=CHUNK.X){cx++;nx-=CHUNK.X;}
  if(nz<0){cz--;nz+=CHUNK.Z;}
  if(nz>=CHUNK.Z){cz++;nz-=CHUNK.Z;}
  const nc=chunks.get(key(cx,cz));
  if(!nc||!nc.generated) return BLOCK.AIR;
  return nc.blocks[idx(nx,ny,nz)];
}

function buildMesh(c){
  if(c.mesh){ scene.remove(c.mesh); c.mesh.geometry.dispose(); }
  const pos=[],norm=[],col=[];
  const baseX=c.cx*CHUNK.X, baseZ=c.cz*CHUNK.Z;

  const pushTri=(a,b,c_,n,color)=>{
    pos.push(a.x,a.y,a.z,b.x,b.y,b.z,c_.x,c_.y,c_.z);
    norm.push(n.x,n.y,n.z,n.x,n.y,n.z,n.x,n.y,n.z);
    for(let i=0;i<3;i++) col.push(color.r,color.g,color.b);
  };
  const pushQuad=(p0,p1,p2,p3,n,color)=>{
    pushTri(p0,p1,p2,n,color);
    pushTri(p0,p2,p3,n,color);
  };
  const addFace=(x,y,z,dir,color)=>{
    const bx=baseX+x, by=y, bz=baseZ+z;
    switch(dir){
      case 0: pushQuad(
        new THREE.Vector3(bx+1,by,bz),
        new THREE.Vector3(bx+1,by,bz+1),
        new THREE.Vector3(bx+1,by+1,bz+1),
        new THREE.Vector3(bx+1,by+1,bz),
        new THREE.Vector3(1,0,0),color); break;
      case 1: pushQuad(
        new THREE.Vector3(bx,by,bz+1),
        new THREE.Vector3(bx,by,bz),
        new THREE.Vector3(bx,by+1,bz),
        new THREE.Vector3(bx,by+1,bz+1),
        new THREE.Vector3(-1,0,0),color); break;
      case 2: pushQuad(
        new THREE.Vector3(bx,by+1,bz),
        new THREE.Vector3(bx+1,by+1,bz),
        new THREE.Vector3(bx+1,by+1,bz+1),
        new THREE.Vector3(bx,by+1,bz+1),
        new THREE.Vector3(0,1,0),color); break;
      case 3: pushQuad(
        new THREE.Vector3(bx,by,bz+1),
        new THREE.Vector3(bx,by,bz),
        new THREE.Vector3(bx+1,by,bz),
        new THREE.Vector3(bx+1,by,bz+1),
        new THREE.Vector3(0,-1,0),color); break;
      case 4: pushQuad(
        new THREE.Vector3(bx+1,by,bz+1),
        new THREE.Vector3(bx,by,bz+1),
        new THREE.Vector3(bx,by+1,bz+1),
        new THREE.Vector3(bx+1,by+1,bz+1),
        new THREE.Vector3(0,0,1),color); break;
      case 5: pushQuad(
        new THREE.Vector3(bx,by,bz),
        new THREE.Vector3(bx+1,by,bz),
        new THREE.Vector3(bx+1,by+1,bz),
        new THREE.Vector3(bx,by+1,bz),
        new THREE.Vector3(0,0,-1),color); break;
    }
  };

  for(let y=0;y<CHUNK.Y;y++){
    for(let z=0;z<CHUNK.Z;z++){
      for(let x=0;x<CHUNK.X;x++){
        const id=c.blocks[idx(x,y,z)];
        if(id===BLOCK.AIR) continue;
        const color=blockColor(id);
        for(let d=0;d<6;d++){
          const nb=neighborBlock(c,x,y,z,d);
          if(isTransparent(nb)) addFace(x,y,z,d,color);
        }
      }
    }
  }

  const geom=new THREE.BufferGeometry();
  geom.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geom.setAttribute("normal",new THREE.Float32BufferAttribute(norm,3));
  geom.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  geom.computeBoundingSphere();
  const mat=new THREE.MeshLambertMaterial({vertexColors:true,fog:true});
  c.mesh=new THREE.Mesh(geom,mat);
  scene.add(c.mesh);
}

/* ===== World Management ===== */
function ensureGrid(wx,wz){
  const pcx=Math.floor(wx/CHUNK.X), pcz=Math.floor(wz/CHUNK.Z);
  for(let dz=-GRID_RADIUS;dz<=GRID_RADIUS;dz++){
    for(let dx=-GRID_RADIUS;dx<=GRID_RADIUS;dx++){
      const cx=pcx+dx, cz=pcz+dz;
      const k=key(cx,cz);
      let ch=chunks.get(k);
      if(!ch){ ch=new Chunk(cx,cz); chunks.set(k,ch); }
      if(!ch.generated) generateChunk(ch);
      buildMesh(ch);
    }
  }
}
function regenAll(){
  for(const [,ch] of chunks){
    if(ch.mesh){scene.remove(ch.mesh);ch.mesh.geometry.dispose();}
  }
  chunks.clear();
  ensureGrid(player.pos.x,player.pos.z);
}

/* ===== Block Editing ===== */
function getBlock(wx,wy,wz){
  const cx=Math.floor(wx/CHUNK.X), cz=Math.floor(wz/CHUNK.Z);
  const ch=chunks.get(key(cx,cz)); if(!ch) return BLOCK.AIR;
  const lx=wx-cx*CHUNK.X, ly=wy, lz=wz-cz*CHUNK.Z;
  if(lx<0||lx>=CHUNK.X||ly<0||ly>=CHUNK.Y||lz<0||lz>=CHUNK.Z) return BLOCK.AIR;
  return ch.blocks[idx(lx,ly,lz)];
}
function setBlock(wx,wy,wz,id){
  const cx=Math.floor(wx/CHUNK.X), cz=Math.floor(wz/CHUNK.Z);
  const ch=chunks.get(key(cx,cz)); if(!ch) return;
  const lx=wx-cx*CHUNK.X, ly=wy, lz=wz-cz*CHUNK.Z;
  if(lx<0||lx>=CHUNK.X||ly<0||ly>=CHUNK.Y||lz<0||lz>=CHUNK.Z) return;
  ch.blocks[idx(lx,ly,lz)]=id;
  buildMesh(ch);
}

/* ===== Player Physics ===== */
const player = {
  pos: new THREE.Vector3(8, 50, 8),
  vel: new THREE.Vector3(0,0,0),
  size: new THREE.Vector3(0.6, 1.8, 0.6),
  grounded: false
};

function eachCollidingBlock(pos, size, cb){
  const half = size.clone().multiplyScalar(0.5);
  const pMin = pos.clone().sub(half);
  const pMax = pos.clone().add(half);
  const minX=Math.floor(pMin.x), maxX=Math.floor(pMax.x);
  const minY=Math.floor(pMin.y), maxY=Math.floor(pMax.y);
  const minZ=Math.floor(pMin.z), maxZ=Math.floor(pMax.z);
  for(let x=minX; x<=maxX; x++){
    for(let y=minY; y<=maxY; y++){
      for(let z=minZ; z<=maxZ; z++){
        if(getBlock(x,y,z)!==BLOCK.AIR){
          const bMin=new THREE.Vector3(x,y,z);
          const bMax=new THREE.Vector3(x+1,y+1,z+1);
          cb(bMin,bMax);
        }
      }
    }
  }
}

function moveAndCollide(dtFactor){
  player.grounded=false;
  // Y
  player.pos.y += player.vel.y*dtFactor;
  const halfY=player.size.y*0.5;
  eachCollidingBlock(player.pos,player.size,(bMin,bMax)=>{
    const pMinY=player.pos.y-halfY;
    const pMaxY=player.pos.y+halfY;
    if(player.vel.y>0 && pMinY<bMax.y && pMaxY>bMin.y){
      player.pos.y=bMin.y-halfY-0.001; player.vel.y=0;
    }
    if(player.vel.y<0 && pMaxY>bMin.y && pMinY<bMax.y){
      player.pos.y=bMax.y+halfY+0.001; player.vel.y=0; player.grounded=true;
    }
  });
  // X
  player.pos.x += player.vel.x*dtFactor;
  const halfX=player.size.x*0.5;
  eachCollidingBlock(player.pos,player.size,(bMin,bMax)=>{
    const pMinX=player.pos.x-halfX, pMaxX=player.pos.x+halfX;
    if(player.vel.x>0 && pMaxX>bMin.x && pMinX<bMax.x){
      player.pos.x=bMin.x-halfX-0.001; player.vel.x=0;
    } else if(player.vel.x<0 && pMinX<bMax.x && pMaxX>bMin.x){
      player.pos.x=bMax.x+halfX+0.001; player.vel.x=0;
    }
  });
  // Z
  player.pos.z += player.vel.z*dtFactor;
  const halfZ=player.size.z*0.5;
  eachCollidingBlock(player.pos,player.size,(bMin,bMax)=>{
    const pMinZ=player.pos.z-halfZ, pMaxZ=player.pos.z+halfZ;
    if(player.vel.z>0 && pMaxZ>bMin.z && pMinZ<bMax.z){
      player.pos.z=bMin.z-halfZ-0.001; player.vel.z=0;
    } else if(player.vel.z<0 && pMinZ<bMax.z && pMaxZ>bMin.z){
      player.pos.z=bMax.z+halfZ+0.001; player.vel.z=0;
    }
  });
}

/* ===== Loop ===== */
ensureGrid(player.pos.x,player.pos.z);
let last=performance.now();
function animate(now){
  const dt=(now-last)/1000; last=now;
  const dtFactor=Math.min(dt*60,2);

  camera.rotation.set(pitch,yaw,0,"YXZ");
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-1).normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();

  let speed=keys.has("shift")?SPRINT:WALK;
  if(keys.has("w")) player.vel.addScaledVector(forward, speed);
  if(keys.has("s")) player.vel.addScaledVector(forward,-speed);
  if(keys.has("a")) player.vel.addScaledVector(right,-speed);
  if(keys.has("d")) player.vel.addScaledVector(right, speed);
  if(keys.has(" ") && player.grounded){ player.vel.y=JUMP_VEL; }

  player.vel.y += GRAVITY*dtFactor;
  moveAndCollide(dtFactor);
  player.vel.x*=0.91; player.vel.z*=0.91;

  camera.position.copy(player.pos).add(new THREE.Vector3(0,player.size.y*0.4,0));

  ensureGrid(player.pos.x,player.pos.z);
  info.textContent=`Pos ${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)},${player.pos.z.toFixed(1)} | grounded:${player.grounded}`;
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
