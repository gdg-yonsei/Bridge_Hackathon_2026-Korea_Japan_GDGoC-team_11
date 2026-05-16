from enum import StrEnum


class DiaryStatus(StrEnum):
    pending = "pending"
    analyzing = "analyzing"
    done = "done"
    failed = "failed"


class Emotion(StrEnum):
    joy = "joy"
    calm = "calm"
    comfort = "comfort"
    sad = "sad"
    anxious = "anxious"
    angry = "angry"


EMOTIONS: tuple[str, ...] = tuple(e.value for e in Emotion)


class MessageRole(StrEnum):
    user = "user"
    assistant = "assistant"
    system = "system"
