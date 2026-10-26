export const LIGHT_LEVELS = [
  { size: 3, name: '初次点亮', scramble: [0, 1] },
  { size: 4, name: '交错星光', scramble: [0, 1, 6, 11] },
  { size: 5, name: '银河合奏', scramble: [0, 1, 7, 12, 19, 24] },
  { size: 5, name: '星环回声', scramble: [0, 1, 3, 6, 10, 13, 18, 24] },
  { size: 5, name: '交织星河', scramble: [0, 1, 2, 4, 6, 8, 11, 15, 18, 22] },
  { size: 5, name: '群星共鸣', scramble: [1, 2, 4, 5, 6, 7, 9, 14, 16, 17, 18, 21] },
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
