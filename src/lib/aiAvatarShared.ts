export const BUILTIN_AI_AVATARS = ["/ai-avatars/1.webp", "/ai-avatars/2.webp", "/ai-avatars/3.webp", "/ai-avatars/4.webp", "/ai-avatars/5.webp", "/ai-avatars/6.webp"];

export interface AiAvatarState {
  avatars: string[];
  custom: boolean;
  chosen: string;
}

export const AI_AVATAR_FALLBACK: AiAvatarState = { avatars: BUILTIN_AI_AVATARS, custom: false, chosen: BUILTIN_AI_AVATARS[0] };
