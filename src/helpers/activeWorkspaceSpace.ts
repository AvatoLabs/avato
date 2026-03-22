/**
 * Last Space the user selected in Resource Manager (URL-driven `setSpaceId`).
 * Optional hint for APIs that accept `spaceId` (e.g. market `exportAndUploadFile` → `createFileRecord` / `space_blobs`).
 * Cleared when Resource routes set `spaceId` to `undefined`.
 */
let activeWorkspaceSpaceId: string | undefined;

export function getActiveWorkspaceSpaceId(): string | undefined {
  return activeWorkspaceSpaceId;
}

export function setActiveWorkspaceSpaceId(spaceId: string | undefined): void {
  activeWorkspaceSpaceId = spaceId;
}
