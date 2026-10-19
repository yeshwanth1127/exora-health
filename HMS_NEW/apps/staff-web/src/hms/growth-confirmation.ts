/** Polling can replace an object without changing the reviewed record's contents. */
export function sameReviewedValue(
  current: unknown,
  reviewed: unknown,
): boolean {
  return (
    current !== undefined &&
    reviewed !== null &&
    reviewed !== undefined &&
    JSON.stringify(current) === JSON.stringify(reviewed)
  );
}

export function reviewedTarget<T extends { id: string }>(
  items: readonly T[],
  reviewed: T | null,
): T | undefined {
  if (!reviewed) return undefined;
  const current = items.find((item) => item.id === reviewed.id);
  return sameReviewedValue(current, reviewed) ? current : undefined;
}

export function canCancelPreviewCampaign(
  campaign: { status: string; stats: { sent: number } | null } | undefined,
): boolean {
  return (
    !!campaign &&
    (campaign.status === "in_review" || campaign.status === "scheduled") &&
    (campaign.stats === null || campaign.stats?.sent === 0)
  );
}

/** Consumed before the callback so two clicks in one render cannot commit twice. */
export function confirmationCommit() {
  let committed = false;
  return (blocked: boolean, action: () => void): boolean => {
    if (blocked || committed) return false;
    committed = true;
    try {
      action();
    } catch (error) {
      committed = false;
      throw error;
    }
    return true;
  };
}
