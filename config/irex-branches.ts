export interface IrexBranch {
  id: string
  city: string
  state: string
  lat: number
  lng: number
}

export const IREX_BRANCHES: IrexBranch[] = [
  { id: 'BOI', city: 'Boise', state: 'ID', lat: 43.613474, lng: -116.56564 },
  { id: 'LAX', city: 'Los Angeles', state: 'CA', lat: 33.94939, lng: -118.078322 },
  { id: 'PSC', city: 'Pasco', state: 'WA', lat: 46.240021, lng: -119.080706 },
  { id: 'PHX', city: 'Phoenix', state: 'AZ', lat: 33.429083, lng: -111.896569 },
  { id: 'POR', city: 'Portland', state: 'OR', lat: 45.438686, lng: -122.619297 },
  { id: 'SLC', city: 'Salt Lake City', state: 'UT', lat: 40.853845, lng: -111.91627 },
  { id: 'SEA', city: 'Seattle', state: 'WA', lat: 47.437216, lng: -122.225009 },
]
