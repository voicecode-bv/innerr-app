import { externalApi } from '@/spa/http/externalApi';

/**
 * Add the given posts to the given circles in a single request. The server
 * attaches circles additively (existing circles are kept) and silently skips
 * any post the user does not own. Returns the number of posts that were
 * actually updated.
 */
export async function addPostsToCircles(
    postIds: string[],
    circleIds: string[],
): Promise<number> {
    const response = await externalApi.post<{ updated_count: number }>(
        '/posts/batch/circles',
        { post_ids: postIds, circle_ids: circleIds },
    );

    return response.updated_count;
}
