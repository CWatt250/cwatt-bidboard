export type LocalNumber = 7 | 16 | 28 | 36 | 69 | 73 | 76 | 82 | 135

export interface LocalInfo {
  number: LocalNumber
  name: string
  color: string
  hallCity: string
  jurisdiction: string
  center: [number, number] // [lat, lng]
  zoom: number
}

export const LOCALS: Record<LocalNumber, LocalInfo> = {
  7: {
    number: 7,
    name: 'Local 7',
    color: '#3dd68c',
    hallCity: 'Tukwila, WA',
    jurisdiction:
      'Western Washington: Chelan, Clallam, Douglas, Grays Harbor, Island, Jefferson, King, Kitsap, Kittitas, Lewis, Mason, Okanogan, Pacific, Pierce, San Juan, Skagit, Snohomish, Thurston, Whatcom, and Yakima counties.',
    center: [47.5, -122.0],
    zoom: 7,
  },
  16: {
    number: 16,
    name: 'Local 16',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#a78bfa',
    hallCity: '',
    jurisdiction: 'Northern California + NW Nevada (Washoe, Carson City, and surrounding area)',
    center: [38.8, -121.8],
    zoom: 6,
  },
  28: {
    number: 28,
    name: 'Local 28',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#14b8a6',
    hallCity: '',
    jurisdiction: 'Colorado statewide + SE Wyoming (Albany, Carbon, Goshen, Laramie, Niobrara, Platte)',
    center: [39.5, -105.7],
    zoom: 7,
  },
  36: {
    number: 36,
    name: 'Local 36',
    color: '#f5a623',
    hallCity: 'Clackamas, OR',
    jurisdiction:
      'Oregon statewide and SW Washington: Wahkiakum, Cowlitz, Clark, Skamania, and Klickitat counties.',
    center: [44.0, -121.5],
    zoom: 6,
  },
  69: {
    number: 69,
    name: 'Local 69',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#ec4899',
    hallCity: '',
    jurisdiction: 'Utah statewide + parts of NV, WY, and ID (Elko/White Pine/Eureka, Sweetwater/Uinta/Lincoln, SE Idaho)',
    center: [39.7, -111.7],
    zoom: 7,
  },
  73: {
    number: 73,
    name: 'Local 73',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#ef4444',
    hallCity: '',
    jurisdiction: 'All Arizona',
    center: [34.2, -111.8],
    zoom: 7,
  },
  76: {
    number: 76,
    name: 'Local 76',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#fbbf24',
    hallCity: '',
    jurisdiction: 'Most of NM + West TX (6 counties) + SW CO (5 counties)',
    center: [33.8, -106.5],
    zoom: 7,
  },
  82: {
    number: 82,
    name: 'Local 82',
    color: '#4a9eff',
    hallCity: 'Spokane, WA',
    jurisdiction:
      'Eastern Washington (19 counties east of Cascade crest), Northern Idaho (10 counties north of the Salmon River), and all of Montana (56 counties).',
    center: [47.0, -110.5],
    zoom: 6,
  },
  135: {
    number: 135,
    name: 'Local 135',
    // Placeholder — swap with actual SubWatt color when available.
    color: '#06b6d4',
    hallCity: '',
    jurisdiction: 'Southern Nevada (Clark, Lincoln, Nye, Esmeralda)',
    center: [37.0, -115.7],
    zoom: 7,
  },
}
