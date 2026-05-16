from enum import StrEnum


class DiaryStatus(StrEnum):
    pending = "pending"
    analyzing = "analyzing"
    done = "done"
    failed = "failed"


class Emotion(StrEnum):
    joy = "joy"
    sad = "sad"
    anger = "anger"
    anxiety = "anxiety"
    calm = "calm"
    embarrassment = "embarrassment"
    envy = "envy"
    boredom = "boredom"
    nostalgia = "nostalgia"


EMOTIONS: tuple[str, ...] = tuple(e.value for e in Emotion)


class MessageRole(StrEnum):
    user = "user"
    assistant = "assistant"
    system = "system"
