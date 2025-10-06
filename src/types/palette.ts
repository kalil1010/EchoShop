export interface OutfitColorPlan {
  top?: string;
  bottom?: string;
  outerwear?: string;
  footwear?: string;
  accessory?: string;
}

export interface SavedPalette {
  id: string;
  ownerId: string;
  name?: string;
  baseHex: string;
  dominantHexes: string[];
  richMatches: any;
  plan?: OutfitColorPlan;
  source?: 'analyzer' | 'closet';
  createdAt: Date;
  updatedAt: Date;
}

// Exclude id, timestamps, and ownerId so the client doesn't have to supply ownerId
export type NewSavedPalette = Omit<
  SavedPalette,
  'id' | 'createdAt' | 'updatedAt' | 'ownerId'
>;