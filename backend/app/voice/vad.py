"""Server-side voice activity detection on 16 kHz mono PCM16, with an adaptive noise floor."""
import io
import math
import wave
from array import array

SAMPLE_RATE = 16000
FRAME_SAMPLES = 320  # 20 ms
FRAME_BYTES = FRAME_SAMPLES * 2


def rms(frame: bytes) -> float:
    a = array("h")
    a.frombytes(frame)
    if not a:
        return 0.0
    return math.sqrt(sum(s * s for s in a) / len(a))


def to_wav(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buf.getvalue()


class Vad:
    """feed() returns a list of ("start", None) / ("end", pcm_bytes) events."""

    def __init__(self, start_frames: int = 4, end_silence_frames: int = 35, min_speech_frames: int = 12,
                 min_threshold: float = 450.0, max_utterance_s: float = 20.0) -> None:
        self.start_frames = start_frames
        self.end_silence_frames = end_silence_frames
        self.min_speech_frames = min_speech_frames
        self.min_threshold = min_threshold
        self.max_frames = int(max_utterance_s * 1000 / 20)
        self.floor = 150.0
        self._buf = b""
        self._speaking = False
        self._run = 0
        self._silence = 0
        self._pending: list[bytes] = []   # frames seen while deciding if speech started
        self._utt: list[bytes] = []

    @property
    def speaking(self) -> bool:
        return self._speaking

    def reset(self) -> None:
        self._buf = b""
        self._speaking = False
        self._run = self._silence = 0
        self._pending, self._utt = [], []

    def feed(self, data: bytes) -> list[tuple[str, bytes | None]]:
        events: list[tuple[str, bytes | None]] = []
        self._buf += data
        while len(self._buf) >= FRAME_BYTES:
            frame, self._buf = self._buf[:FRAME_BYTES], self._buf[FRAME_BYTES:]
            level = rms(frame)
            threshold = max(self.min_threshold, self.floor * 3.0)
            loud = level >= threshold
            if not self._speaking:
                if not loud:
                    self.floor = 0.95 * self.floor + 0.05 * level  # learn the room noise
                    self._run = 0
                    self._pending = []
                    continue
                self._run += 1
                self._pending.append(frame)
                if self._run >= self.start_frames:
                    self._speaking = True
                    self._utt = list(self._pending)
                    self._pending = []
                    self._silence = 0
                    events.append(("start", None))
            else:
                self._utt.append(frame)
                self._silence = 0 if loud else self._silence + 1
                if self._silence >= self.end_silence_frames or len(self._utt) >= self.max_frames:
                    voiced = len(self._utt) - self._silence
                    pcm = b"".join(self._utt)
                    self._speaking = False
                    self._run = self._silence = 0
                    self._utt = []
                    if voiced >= self.min_speech_frames:
                        events.append(("end", pcm))
        return events
