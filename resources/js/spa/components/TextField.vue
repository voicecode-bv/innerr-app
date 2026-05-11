<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';

type InputType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'search';

const props = withDefaults(
    defineProps<{
        modelValue: string;
        type?: InputType;
        name?: string;
        placeholder?: string;
        autocomplete?: string;
        error?: string;
        transform?: (value: string) => string;
    }>(),
    {
        type: 'text',
        name: undefined,
        placeholder: undefined,
        autocomplete: undefined,
        error: undefined,
        transform: undefined,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const { t } = useTranslations();
const showPassword = ref(false);

const isPassword = computed(() => props.type === 'password');
const effectiveType = computed(() =>
    isPassword.value && showPassword.value ? 'text' : props.type,
);

function onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    emit('update:modelValue', props.transform ? props.transform(raw) : raw);
}
</script>

<template>
    <div>
        <div class="relative">
            <input
                :value="modelValue"
                :type="effectiveType"
                :name="name"
                :placeholder="placeholder"
                :autocomplete="autocomplete"
                class="field"
                :class="[
                    error
                        ? 'border-blush-400 focus:border-blush-400 focus:ring-blush-400/15'
                        : '',
                    isPassword ? 'pr-16' : '',
                ]"
                @input="onInput"
            />
            <button
                v-if="isPassword"
                type="button"
                class="absolute top-1/2 right-3 -translate-y-1/2 font-semibold text-teal transition-colors hover:text-teal-light"
                @click="showPassword = !showPassword"
            >
                {{ showPassword ? t('Hide') : t('Show') }}
            </button>
        </div>
        <p v-if="error" class="mt-1 text-blush-500">{{ error }}</p>
    </div>
</template>
