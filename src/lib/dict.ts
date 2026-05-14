export function parsePinyinTxt(text: string) {
    const lines = text.split('\n');
    const results: Array<{text: string, pinyin: string, initials: string, weight: number}> = [];
    for (const line of lines) {
        const trimmed = line.split('#')[0].trim();
        if (!trimmed) continue;
        // Format: U+XXXX: pinyin, pinyin
        const match = trimmed.match(/^U\+([0-9A-Fa-f]+):\s*(.+)$/);
        if (match) {
            try {
                const char = String.fromCodePoint(parseInt(match[1], 16));
                const pinyins = match[2].split(',').map(s => s.trim());
                for (const py of pinyins) {
                    const noTone = py.normalize("NFD")
                        .replace(/u\u0308/ig, "v")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[0-9]/g, "")
                        .toLowerCase();
                    if (!noTone) continue;
                    results.push({
                        text: char,
                        pinyin: noTone,
                        initials: noTone.charAt(0),
                        weight: 10 // Basic low weight
                    });
                }
            } catch(e) {}
        }
    }
    return results;
}
