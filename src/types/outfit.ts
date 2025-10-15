export type OutfitSource = 'closet' | 'online'

export interface OutfitPieceRecommendation {
  summary: string
  color?: string
  source?: OutfitSource
  sourceUrl?: string
  onlinePieceId?: string
}

export interface OutfitSuggestionResponse {
  top: OutfitPieceRecommendation
  bottom: OutfitPieceRecommendation
  footwear: OutfitPieceRecommendation
  accessories: OutfitPieceRecommendation[]
  outerwear?: OutfitPieceRecommendation
  styleNotes: string
}
