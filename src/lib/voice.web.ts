// Voice is off on the web: browser speech recognition sends the audio to a server, which would
// break Still's promise that nothing leaves the device. Phones use voice.ts (on-device only).
export type VoiceStatus = 'ready' | 'unsupported' | 'offline-missing' | 'denied' | 'asked';
export const voiceStatus = (): VoiceStatus => 'unsupported';
export const startListening = async (): Promise<VoiceStatus | 'listening'> => 'unsupported';
export const stopListening = async (): Promise<string> => '';
