export async function fireConfetti(options?: { particleCount?: number; spread?: number; origin?: { x?: number; y?: number } }) {
  if (typeof window === 'undefined') return
  const confetti = (await import('canvas-confetti')).default
  confetti({
    particleCount: options?.particleCount ?? 70,
    spread: options?.spread ?? 60,
    origin: { y: options?.origin?.y ?? 0.8, x: options?.origin?.x ?? 0.5 },
    ticks: 200,
    scalar: 0.9,
  })
}
