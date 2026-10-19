import { useState } from "react";

/** Keep the reviewed data through the exit animation; never store a stale action. */
export function useConfirmationReview<T>() {
  const [review, setReview] = useState<{ target: T | null; open: boolean }>({
    target: null,
    open: false,
  });
  return {
    ...review,
    request: (target: T) => setReview({ target, open: true }),
    dismiss: () => setReview((old) => ({ ...old, open: false })),
  };
}
