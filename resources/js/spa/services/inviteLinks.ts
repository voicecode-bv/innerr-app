import { externalApi } from '@/spa/http/externalApi';

export interface InviteLinkCircleSummary {
    id: string;
    name: string;
    photo: string | null;
    members_count: number;
}

export interface InviteLinkInviter {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

export interface InviteLinkMemberPreview {
    name: string;
    avatar: string | null;
}

export type InviteLinkInvalidReason = 'expired' | 'revoked' | 'maxed';

export interface InviteLinkPreview {
    valid: boolean;
    reason: InviteLinkInvalidReason | null;
    circle: InviteLinkCircleSummary;
    inviter: InviteLinkInviter;
    member_preview: InviteLinkMemberPreview[];
}

export interface InviteLink {
    id: string;
    token: string;
    url: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    revoked_at: string | null;
    created_at: string;
    created_by?: { id: string; name: string; username: string };
}

export interface AcceptInviteLinkResult {
    message: string;
    already_member: boolean;
    circle: { id: string; name: string };
}

export async function fetchInviteLinkPreview(
    token: string,
): Promise<InviteLinkPreview> {
    const resp = await externalApi.get<{ data: InviteLinkPreview }>(
        `/invite-links/${encodeURIComponent(token)}`,
    );

    return resp.data;
}

export function acceptInviteLink(
    token: string,
): Promise<AcceptInviteLinkResult> {
    return externalApi.post<AcceptInviteLinkResult>(
        `/invite-links/${encodeURIComponent(token)}/accept`,
    );
}

export async function listInviteLinks(circleId: string): Promise<InviteLink[]> {
    const resp = await externalApi.get<{ data: InviteLink[] }>(
        `/circles/${circleId}/invite-links`,
    );

    return resp.data;
}

export async function createInviteLink(
    circleId: string,
    options: { expires_in_days?: number | null; max_uses?: number | null } = {},
): Promise<InviteLink> {
    const resp = await externalApi.post<{ data: InviteLink }>(
        `/circles/${circleId}/invite-links`,
        options,
    );

    return resp.data;
}

export function revokeInviteLink(
    circleId: string,
    linkId: string,
): Promise<void> {
    return externalApi.delete<void>(
        `/circles/${circleId}/invite-links/${linkId}`,
    );
}
