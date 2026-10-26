export const LIGHT_LEVELS = [
  { size: 3, name: '初次点亮', scramble: [0, 1] },
  { size: 4, name: '交错星光', scramble: [0, 1, 6, 11] },
  { size: 5, name: '银河合奏', scramble: [0, 1, 7, 12, 19, 24] },
  { size: 5, name: '星环回声', scramble: [0, 1, 3, 6, 10, 13, 18, 24] },
  { size: 5, name: '交织星河', scramble: [0, 1, 2, 4, 6, 8, 11, 15, 18, 22] },
  { size: 5, name: '群星共鸣', scramble: [1, 2, 4, 5, 6, 7, 9, 14, 16, 17, 18, 21] },
  { size: 5, name: '星桥接力', scramble: [3, 4, 6, 7, 8, 12, 14, 15, 16, 18, 20, 22, 24] },
  { size: 5, name: '双子回廊', scramble: [2, 4, 6, 7, 8, 11, 12, 15, 16, 18, 20, 21, 23] },
  { size: 5, name: '光潮交汇', scramble: [2, 5, 6, 7, 8, 9, 10, 12, 14, 16, 17, 18, 21, 24] },
  { size: 5, name: '星轨迷阵', scramble: [0, 2, 5, 6, 7, 8, 11, 12, 13, 16, 18, 22, 23, 24] },
  { size: 5, name: '深空协奏', scramble: [0, 1, 2, 4, 6, 7, 8, 9, 11, 12, 13, 16, 18, 22, 23] },
  { size: 5, name: '银河重燃', scramble: [0, 3, 5, 6, 8, 9, 10, 11, 12, 15, 16, 17, 18, 20, 21] },
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
