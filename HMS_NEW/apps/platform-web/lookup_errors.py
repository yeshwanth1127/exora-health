"""Public errors contain no Google credentials or raw provider responses."""


class LookupError(Exception):
    def __init__(self, code, message, status=503):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)
