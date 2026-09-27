import * as THREE from 'three';

export const RENDER_CAPABILITY_SCHEMA=2;

export function estimateRenderTargetBytes(width,height,{bytesPerPixel=4,count=1,scale=1}={}){
  const w=Math.max(1,Math.floor(Number(width)||1));
  const h=Math.max(1,Math.floor(Number(height)||1));
  const s=Math.max(.01,Number(scale)||1);
  return Math.round(w*h*s*s*Math.max(1,Number(bytesPerPixel)||4)*Math.max(0,Number(count)||0));
}
