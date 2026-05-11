<script setup lang="ts">
import { computed } from 'vue';
import IconTile from '@/components/IconTile.vue';
import ListItem from '@/spa/components/ListItem.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import usersIcon from '../../../svg/doodle-icons/user.svg';

type AvatarShape = 'circle' | 'square';

interface CircleSummary {
    id: string;
    name: string;
    photo: string | null;
    members_count?: number;
    members_can_view_members?: boolean;
    is_owner?: boolean;
}

const canSeeMemberCount = computed(
    () =>
        props.circle.is_owner === true ||
        props.circle.members_can_view_members !== false,
);

const props = withDefaults(
    defineProps<{
        circle: CircleSummary;
        avatarShape?: AvatarShape;
    }>(),
    {
        avatarShape: 'circle',
    },
);

const { t } = useTranslations();

const avatarRoundingClass = computed(() =>
    props.avatarShape === 'circle' ? 'avatar-ring rounded-full' : 'rounded-lg',
);
const iconTileClass = computed(() =>
    props.avatarShape === 'circle' ? '!rounded-full' : '',
);
</script>

<template>
    <ListItem :to="{ name: 'spa.circles.show', params: { circle: circle.id } }">
        <template #leading>
            <img
                v-if="circle.photo"
                :src="circle.photo"
                :alt="circle.name"
                class="size-12 shrink-0 object-cover"
                :class="avatarRoundingClass"
            />
            <IconTile
                v-else
                :icon="usersIcon"
                size="md"
                tone="sage"
                :class="iconTileClass"
            />
        </template>
        {{ circle.name }}
        <template
            v-if="
                canSeeMemberCount && typeof circle.members_count === 'number'
            "
            #subtitle
        >
            {{
                circle.members_count === 1
                    ? t(':count member', { count: circle.members_count })
                    : t(':count members', { count: circle.members_count })
            }}
        </template>
    </ListItem>
</template>
