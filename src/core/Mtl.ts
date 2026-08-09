export interface MtlMaterial {
  name: string;
  diffuseTexture?: string;
}

const fixedOptionArgumentCounts: Record<string, number> = {
  '-blendu': 1,
  '-blendv': 1,
  '-boost': 1,
  '-bm': 1,
  '-cc': 1,
  '-clamp': 1,
  '-imfchan': 1,
  '-mm': 2,
  '-texres': 1,
  '-type': 1,
};

function parseMapPath(parts: string[]): string | undefined {
  let index = 0;
  while (index < parts.length && parts[index].startsWith('-')) {
    const option = parts[index++].toLowerCase();
    if (option === '-o' || option === '-s' || option === '-t') {
      let consumed = 0;
      while (index < parts.length && consumed < 3 && Number.isFinite(Number(parts[index]))) {
        index++;
        consumed++;
      }
    } else {
      index += fixedOptionArgumentCounts[option] ?? 1;
    }
  }
  const path = parts.slice(index).join(' ').trim();
  return path || undefined;
}

export function parseMtl(text: string): Map<string, MtlMaterial> {
  const materials = new Map<string, MtlMaterial>();
  let current: MtlMaterial | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(part => part.replace(/^"|"$/g, '')) ?? [];
    const directive = parts.shift()?.toLowerCase();

    if (directive === 'newmtl') {
      const name = parts.join(' ').trim();
      if (!name) throw new Error(`MTL newmtl requires a material name: ${line}`);
      current = { name };
      materials.set(name, current);
    } else if (directive === 'map_kd' && current) {
      current.diffuseTexture = parseMapPath(parts);
    }
  }

  return materials;
}