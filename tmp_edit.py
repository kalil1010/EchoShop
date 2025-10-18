from pathlib import Path
import re
path = Path('src/components/closet/ImageUpload.tsx')
text = path.read_text()
pattern = r"  const handleFileSelect = useCallback\(\(event: React.ChangeEvent<HTMLElement>\) => {"
