export interface IrexBranch {
  id: string
  city: string
  state: string
  lat: number
  lng: number
}

export const IREX_BRANCHES: IrexBranch[] = [
  { id: 'BOI', city: 'Boise', state: 'ID', lat: 43.615, lng: -116.2023 },
  { id: 'LAX', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { id: 'PSC', city: 'Pasco', state: 'WA', lat: 46.2396, lng: -119.1006 },
  { id: 'PHX', city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074 },
  { id: 'POR', city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
  { id: 'SLC', city: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.891 },
  { id: 'SEA', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
]
