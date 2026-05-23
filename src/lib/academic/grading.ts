export function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

export type EligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "REVIEW_REQUIRED";

export function checkEligibility(
  attendancePercentage: number,
  failedSubjects: number,
  hasUnpublishedRecords: boolean
): EligibilityStatus {
  if (hasUnpublishedRecords) {
    return "NOT_ELIGIBLE";
  }

  if (failedSubjects > 2) {
    return "NOT_ELIGIBLE";
  }

  if (attendancePercentage < 75 || failedSubjects > 0) {
    return "REVIEW_REQUIRED";
  }

  return "ELIGIBLE";
}
