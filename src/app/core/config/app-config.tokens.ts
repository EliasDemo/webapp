import { InjectionToken } from '@angular/core';
export interface UserSettings { language:'es'|'en'; theme:'light'|'dark'|'system'; density:'comfortable'|'compact'; }
export const DEFAULT_SETTINGS: UserSettings = { language:'es', theme:'system', density:'comfortable' };
export const APP_DEFAULTS = new InjectionToken<UserSettings>('APP_DEFAULTS', { factory: () => DEFAULT_SETTINGS });
