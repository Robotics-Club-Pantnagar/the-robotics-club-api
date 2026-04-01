import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE_KEY = 'skipThrottle';
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);

export const THROTTLE_LIMIT_KEY = 'throttleLimit';
export const ThrottleLimit = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_LIMIT_KEY, { limit, ttl });
