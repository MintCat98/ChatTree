import { MessageType } from '@shared/message-types';

async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument?.()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'On-device embedding inference (transformers.js / ONNX Runtime Web).',
    });
}

export async function embedViaOffscreen(text: string): Promise<number[]> {
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: MessageType.OFFSCREEN_EMBED, text });
    
    if (!res || res.error) throw new Error(res?.error ?? 'no response');
    return res.vector;
}