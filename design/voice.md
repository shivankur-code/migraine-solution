# Voice in Still

Voice goes in, nothing talks back. The answer to a command is the sound changing, with one light
vibration (two soft ones when it was not understood, and nothing changes). Every command is gentler:
softer, darker, less hum, stiller, closer, stop, play, worse, dark screen, a texture or a timer.
Nothing can make the sound louder or brighter.

## Three parts

```
ears (speech -> text)          brain (text -> intents)              hands (intents -> sound)
src/lib/voice.ts      phones   src/lib/interpret.ts                 applyVoice() in src/app/index.tsx
src/lib/voice.web.ts  web        1. words: src/engine/voice-commands.js (on the device)
room/SayOrType.tsx    typed      2. slot for an on-device model
                                 3. server AI (opt-in, text only): src/lib/voiceAsk.ts -> /api/voice
                                 keepSafe(): only intents from INTENTS, timers clamped
```

### Ears: on-device only

| Where | How | Audio leaves the device? |
|---|---|---|
| iPhone and Android apps | `expo-speech-recognition` with `requiresOnDeviceRecognition` | No |
| Chrome, Edge (and any browser that adds it) | Web Speech `SpeechRecognition` with `processLocally = true`, checked first with `SpeechRecognition.available()`; the first hold calls `install()` | No |
| Safari, Firefox without on-device mode, anything else | The "Say or type" box; on iPhone the keyboard's microphone dictates into it, which Apple processes on the phone in many languages | No (keyboard dictation is Apple's; see Apple's Siri & Dictation privacy page) |

Browsers whose speech recognition may send audio to a server are never used for listening.
How to talk to it: hold the lamp, hold anywhere on the dark screen, or (computers) hold Space.

### Brain: add an interpreter

Add an entry to `INTERPRETERS` in `src/lib/interpret.ts`, between `words` and `server-ai`:

```ts
{ name: 'on-device-model', allowed: () => modelReady(), run: async text => askLocalModel(text) },
```

`run` returns `{ intents, timer }` or `null`. Give the model the fixed list (`INTENTS` in
`voice-commands.js`) and ask for one of them or "none", as the server prompt does
(`server/src/voice.ts`). Whatever it returns goes through `keepSafe`, so it can only ever pick
from the list. Candidates:

- **Web:** Chrome's built-in model (Prompt API), where available.
- **iPhone app:** Apple's Foundation Models framework, through a small native module.
- **Android app:** Gemini Nano through Android's on-device AI APIs.

An on-device model needs no opt-in (nothing leaves the device); the server AI stays opt-in.

### Hands

`applyVoice()` turns intents into changes: one dial step down (tone, hum, motion, space), quieter,
a texture, a timer, stop, dark screen, or "worse". A change while sound plays crossfades in.

## Tests

- `tests/voice.test.mjs`: command words, phrases, timers, and that "louder"/"brighter" do nothing.
- `server/test/voice.test.ts`: the server AI's request, answers kept to the list, the 8 s deadline.
- `scripts/web-shots.mjs`: types a command into the "Say or type" box where it shows.
