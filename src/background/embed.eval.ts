import { cosineSimilarity } from '@background/relevance';
import { embedViaOffscreen } from '@background/embed';

const SAMPLES = [
    { label: '고양이1(ko)', text: '고양이가 소파 위에서 낮잠을 자고 있다.' },
    { label: '고양이2(ko)', text: '우리집 냥이는 하루종일 잠만 잔다.' },
    { label: 'cat(en)', text: 'The cat is sleeping on the sofa' },
    { label: 'DB(ko)', text: '데이터베이스는 데이터를 저장하고 관리하는 시스템이다.' },
    { label: 'DB(en)', text: 'A database is a system for storing and managing data.' },
    { label: '날씨(ko)', text: '오늘 서울은 무척 덥고 습한 날씨다.' },
]

export async function runEmbedEval(): Promise<void> {
    const rows: { label: string; vec: number[] }[] = [];
    for (const sample of SAMPLES) {
        const vec = await embedViaOffscreen(sample.text);
        const norm = Math.sqrt(vec.reduce((a, x) => a + x * x, 0));
        console.log(`[eval] ${sample.label.padEnd(11)} dim=${vec.length} norm=${norm.toFixed(3)}`);
        rows.push({ label: sample.label, vec });
    }

    const w = 12;
    console.log('\n[eval] cosine similarity matrix:');
    console.log(''.padEnd(w) + rows.map((r) => r.label.padEnd(w)).join(''));
    for (const a of rows) {
        const line = rows.map((b) => (cosineSimilarity(a.vec, b.vec) ?? NaN).toFixed(3).padEnd(w)).join('');
        console.log(a.label.padEnd(w) + line);
    }
}