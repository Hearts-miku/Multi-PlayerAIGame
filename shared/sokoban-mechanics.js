const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export function plateActive(s, plate) {
  const actor = s.actors.some((p, i) => same(p, plate.at) && (plate.owner === undefined || plate.owner === i));
  const box = s.boxes.some((p, i) => same(p, plate.at) && (plate.owner === undefined || plate.owner === i));
  return plate.accept === 'box' ? box : plate.accept === 'either' ? actor || box : actor;
}
const powered = (s, circuit) => circuit.plates.every((p) => plateActive(s, p));
export function circuitOpen(s, circuit) {
  return (s.latches || []).includes(circuit.id) || (circuit.mode !== 'latch' && powered(s, circuit));
}
export function nextLatches(s) {
  return [...new Set([...(s.latches || []), ...(s.circuits || []).filter((c) => c.mode === 'latch' && powered(s, c)).map((c) => c.id)])];
}
export function gateOpen(s, cell) {
  if (s.circuits?.length) {
    if (!cell) return s.circuits.some((c) => circuitOpen(s, c));
    const circuit = s.circuits.find((c) => c.gates.some((p) => same(p, cell)));
    return !!circuit && circuitOpen(s, circuit);
  }
  return s.plates.some((p) => s.actors.some((a) => same(p, a)));
}
