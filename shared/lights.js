export const LIGHT_LEVELS = [
  { size: 3, name: '初次点亮', scramble: [0, 1] },
  { size: 4, name: '交错星光', scramble: [0, 1, 6, 11] },
  { size: 5, name: '银河合奏', scramble: [0, 1, 7, 12, 19, 24] },
];
export const switchOwner = (index, size) => (Math.floor(index / size) + index % size) % 2;
export function toggleLights(cells, size, index) {
  const result = [...cells], x = index % size, y = Math.floor(index / size);
  for (const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx, ny=y+dy;
    if(nx>=0&&ny>=0&&nx<size&&ny<size) result[ny*size+nx]=!result[ny*size+nx];
  }
  return result;
}
