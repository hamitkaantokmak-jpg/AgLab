// AğLab topoloji JSON'u (v23) için gevşek tipler. Köprü yalnızca burada adı geçen
// alanları yorumlar; geri kalan her alan ya opak olarak geçer ya da raporlanır.

export interface AglabInterface {
  mode?: string
  vlan?: number
  allowed?: number[]
  nativeVlan?: number
  enabled?: boolean
  ip?: string
  mask?: string
  [key: string]: unknown
}

export interface AglabDevice {
  id: string
  name?: string
  type: string
  x?: number
  y?: number
  enabled?: boolean
  ports?: string[]
  interfaces?: Record<string, AglabInterface>
  ip?: string
  mask?: string
  gateway?: string
  mac?: string
  vlan?: number
  vlans?: number[]
  vlanNames?: Record<string, string>
  stpPriority?: number
  stpPriorities?: Record<string, number>
  config?: Record<string, unknown>
  [key: string]: unknown
}

export interface AglabLink {
  a: string
  portA: string
  b: string
  portB: string
  up?: boolean
  [key: string]: unknown
}

export interface AglabTopology {
  devices: AglabDevice[]
  links: AglabLink[]
  [key: string]: unknown
}
