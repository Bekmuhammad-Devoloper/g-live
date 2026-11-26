export const BUILTIN_AI_AVATARS = ["/ai-avatars/1.svg", "/ai-avatars/2.svg", "/ai-avatars/3.svg", "/ai-avatars/4.svg"];

export interface AiAvatarState {
  avatars: string[];
  custom: boolean;
  chosen: string;
}

export const AI_AVATAR_FALLBACK: AiAvatarState = { avatars: BUILTIN_AI_AVATARS, custom: false, chosen: BUILTIN_AI_AVATARS[0] };
