# SPEACH

SPEACH is the local speech-input path for Converged. It turns microphone and
call audio into the same text that CASE and PARAMS receive from a keyboard. A
spoken instruction can therefore enter the normal command and parameter flow
without sending audio to a remote transcription service.

For a recorded request, SPEACH accepts WAV or Opus audio, converts it to a
16 kHz mono waveform, and runs the local CTC model. For a live leg, it decodes
Opus packets, uses voice activity detection to collect a phrase, and emits
partial and completed transcript events. Short pauses stay within a phrase;
silence closes it. A segment is limited to forty seconds.

Recognition ends at text. SPEACH does not guess which screen command the words
refer to. The transcript moves on to the same context-aware routing and
parameter extraction used by typed input.
