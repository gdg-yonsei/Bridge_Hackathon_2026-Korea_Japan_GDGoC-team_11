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


class MessageRole(StrEnum):
    user = "user"
    assistant = "assistant"
    system = "system"
